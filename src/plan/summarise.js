import {
    canonicalLenses
} from "../llm/lenses.js";

import {
    BEHAVIOUR_LINE,
    PLACEHOLDER_VERBS
} from "../llm/behaviour.js";

import {
    DEFAULT_ROLE,
    declarationName
} from "../llm/roles.js";

import {
    createId,
    getNextNodeNumber,
    nodeIdentities
} from "./nodes.js";


// --------------------------------------------------
// KEEP A FEATURE READABLE
// --------------------------------------------------
// A brownfield draft writes one step per significant declaration, and a
// real project has features with a hundred of them. A hundred cards is not
// a plan a person reads; it is the file listing again, with prose.
//
// So a feature holds at most twenty steps. Over that, related steps are
// FOLDED into a summary step that stands for all of them. Nothing is
// dropped and nothing is hidden: every declaration still belongs to
// exactly one node, every rule keeps its own target, and verify still
// checks each declaration against its own rules. What changes is how many
// cards the reader is asked to hold at once.
//
// WHAT IS NEVER FOLDED.
//   - anything a person has ruled on: approved, written by hand, edited by
//     hand, or carrying history. Their decision is about the step they
//     read, and moving it onto a claim they never read would be a lie.
//   - terms, preconditions and helpers. They are not steps, they are not
//     counted against the cap, and they are drawn beside the spine.
//
// This module is pure. It reads a plan object and a call graph and returns
// new nodes; it opens no file and makes no request. The one thing it
// cannot do alone is write a good title for a group, and that is a
// separate function below which takes the model call as an argument.
// --------------------------------------------------

export const FEATURE_STEP_CAP = 20;

// --------------------------------------------------
// AND NO SUMMARY STEP MAY COVER MORE THAN THIS
// --------------------------------------------------
// The cap keeps a feature readable; this keeps each card reviewable, and
// it is the harder of the two constraints.
//
// Measured on expressjs/express 4.21.2: a feature with 25 approved steps
// already fills the cap, so its budget falls to one group, and every one
// of the 136 new steps folded into a single card. Nobody reviews a card
// that covers 136 steps - and the honest failure is a feature that stays
// over twenty and says why, not one card standing in for half the repo.
//
// So the cap gives way first. A feature that cannot reach its budget
// without breaking this limit stops folding and reports the overflow.
//
// Counted in COVERED STEPS - summaryOf entries, flattened - not in
// declarations, because covered steps are what a reader has to read.
// --------------------------------------------------

export const MAX_SUMMARY_SIZE = 12;

// How many summary steps go in one titling request. Small enough that the
// answer stays inside a reply, large enough that a capped draft is a
// handful of calls rather than one per group.
export const TITLE_CHUNK = 15;


// --------------------------------------------------
// WHAT MAY BE FOLDED
// --------------------------------------------------

// A node with no role is a step. That is what DEFAULT_ROLE says, what
// roleOf() in the webview draws, and what the draft falls back to - but
// the cap used to require the field to be present, so a step added with
// `plan add` (which writes no role) did not count towards the cap, and a
// plan drafted before roles existed was never summarised at all.
function roleOf(
    node
) {
    return node?.role || DEFAULT_ROLE;
}


function isEligible(
    node
) {
    return (
        roleOf(node) === "behaviour" &&
        node?.origin === "ai_drafted" &&
        node?.status === "intended" &&
        !(
            Array.isArray(node.history) &&
            node.history.length > 0
        ) &&
        typeof node.identity === "string" &&
        node.identity.length > 0
    );
}


function isBehaviour(
    node
) {
    return roleOf(node) === "behaviour";
}


// What one group would cost a reader: the steps it covers, not the
// declarations it holds. A member that is already a summary contributes
// everything IT covers, so folding twice cannot smuggle a group past the
// limit one level down.
function coveredSize(
    group
) {
    return group.members.reduce(
        (total, member) =>
            total +
            (
                Array.isArray(member.summaryOf) &&
                member.summaryOf.length > 0
                    ? member.summaryOf.length
                    : 1
            ),
        0
    );
}


const stepOf =
    node =>
        Number.isFinite(node?.step)
            ? node.step
            : Number.MAX_SAFE_INTEGER;


// The one order everything here reads in: the order a person meets the
// steps, with the id breaking ties so two steps numbered the same never
// depend on which one the array happened to hold first.
const byStep =
    (left, right) =>
        stepOf(left) - stepOf(right) ||
        String(left?.id ?? "").localeCompare(
            String(right?.id ?? "")
        );


function headingOf(
    node
) {
    return Array.isArray(node?.path) &&
        typeof node.path[0] === "string"
        ? node.path[0]
        : "";
}


function commonPrefix(
    trails
) {
    if (
        trails.length === 0
    ) {
        return [];
    }

    const first =
        trails[0];

    let length =
        first.length;

    for (
        const other of trails
    ) {
        let shared = 0;

        while (
            shared < length &&
            shared < other.length &&
            other[shared] === first[shared]
        ) {
            shared += 1;
        }

        length = shared;
    }

    return first.slice(
        0,
        length
    );
}


// --------------------------------------------------
// THE THREE FOLDS
// --------------------------------------------------
// Each starts from one group per step and merges until the feature fits.
// They run in order of how much they claim.
//
// 1. THE CALL TREE says something the code actually shows: this step is
//    only ever reached through that one. Folding it in loses nothing a
//    reader could have used, because it was never a separate entry point.
//
// 2. THE PART is what the outline already decided these steps have in
//    common. Weaker than a call - a shared heading is a judgement, not a
//    fact - but it is the same judgement the rest of the interface bands
//    the spine by, so a summary step never straddles a lane label.
//
// 3. NEIGHBOURS is the floor: adjacent in step order, smallest first. It
//    claims nothing beyond "these were next to each other", which is why
//    it runs last and only on what the first two could not place.
//
// Smallest-combined-size first, in both of the last two, so the folding
// spreads instead of growing one enormous step that swallows the feature.
// --------------------------------------------------

function mergeGroups(
    groups,
    into,
    from
) {
    groups[into].members =
        [
            ...groups[into].members,
            ...groups[from].members
        ].sort(byStep);

    groups.splice(
        from,
        1
    );

    groups.sort(
        (left, right) =>
            byStep(
                left.members[0],
                right.members[0]
            )
    );
}


// The one group every caller of this group sits in, or -1 when there is no
// such group: nothing calls it, its callers are spread over more than one
// group, or a caller sits outside this feature's groups entirely (another
// feature, or a settled step that is not being folded).
function soleCallerGroup(
    groups,
    index,
    callers,
    groupOf
) {
    const own =
        new Set(
            groups[index].members.flatMap(
                nodeIdentities
            )
        );

    let into = -1;

    for (
        const identity of own
    ) {
        for (
            const caller of callers?.get(identity) || []
        ) {
            // A call between two declarations of this same step is the
            // step calling itself, which says nothing about where it
            // belongs.
            if (
                own.has(caller)
            ) {
                continue;
            }

            const at =
                groupOf.get(caller);

            if (
                at === undefined
            ) {
                return -1;
            }

            if (
                into === -1
            ) {
                into = at;
            } else if (
                into !== at
            ) {
                return -1;
            }
        }
    }

    return into;
}


function foldCallTree(
    groups,
    budget,
    callers,
    limit
) {
    // ponytail: one merge per sweep, candidates recomputed. O(groups^3) at
    // worst; batch a whole sweep if a single feature ever holds thousands.
    while (
        groups.length > budget
    ) {
        const groupOf =
            new Map();

        groups.forEach(
            (group, index) => {
                for (
                    const member of group.members
                ) {
                    for (
                        const identity of nodeIdentities(member)
                    ) {
                        groupOf.set(
                            identity,
                            index
                        );
                    }
                }
            }
        );

        const candidates =
            [];

        groups.forEach(
            (group, index) => {
                const into =
                    soleCallerGroup(
                        groups,
                        index,
                        callers,
                        groupOf
                    );

                if (
                    into === -1 ||
                    into === index
                ) {
                    return;
                }

                // A call is the best reason there is to fold two steps
                // together, and it is still not a reason to build a card
                // nobody can read.
                if (
                    coveredSize(groups[into]) +
                        coveredSize(group) > limit
                ) {
                    return;
                }

                candidates.push({
                    into,
                    from: index
                });
            }
        );

        if (
            candidates.length === 0
        ) {
            return;
        }

        // The caller's position, then the callee's.
        candidates.sort(
            (left, right) =>
                left.into - right.into ||
                left.from - right.from
        );

        mergeGroups(
            groups,
            candidates[0].into,
            candidates[0].from
        );
    }
}


// The smallest pair of neighbours, where "neighbours" means adjacent in
// the list of positions handed in. Ties go to the earliest.
//
// Measured in covered steps, and a pair whose combined size would break
// the limit is not a candidate at all - so the fold stops rather than
// growing one unreadable card. Returns null when nothing may merge.
function smallestPair(
    groups,
    positions,
    limit
) {
    let best = null;

    for (
        let at = 0;
        at + 1 < positions.length;
        at += 1
    ) {
        const left =
            positions[at];

        const right =
            positions[at + 1];

        const size =
            coveredSize(groups[left]) +
            coveredSize(groups[right]);

        if (
            size > limit
        ) {
            continue;
        }

        if (
            !best ||
            size < best.size ||
            (
                size === best.size &&
                left < best.left
            )
        ) {
            best = {
                size,
                left,
                right
            };
        }
    }

    return best;
}


function foldSamePart(
    groups,
    budget,
    limit
) {
    while (
        groups.length > budget
    ) {
        const byHeading =
            new Map();

        groups.forEach(
            (group, index) => {
                const heading =
                    headingOf(group.members[0]);

                // No heading is not a shared heading. Those groups are left
                // to the neighbour fold, which is what they amount to.
                if (
                    !heading
                ) {
                    return;
                }

                if (
                    !byHeading.has(heading)
                ) {
                    byHeading.set(
                        heading,
                        []
                    );
                }

                byHeading
                    .get(heading)
                    .push(index);
            }
        );

        let best = null;

        for (
            const positions of byHeading.values()
        ) {
            const pair =
                smallestPair(
                    groups,
                    positions,
                    limit
                );

            if (
                pair &&
                (
                    !best ||
                    pair.size < best.size ||
                    (
                        pair.size === best.size &&
                        pair.left < best.left
                    )
                )
            ) {
                best = pair;
            }
        }

        if (
            !best
        ) {
            return;
        }

        mergeGroups(
            groups,
            best.left,
            best.right
        );
    }
}


function foldNeighbours(
    groups,
    budget,
    limit
) {
    while (
        groups.length > budget
    ) {
        const best =
            smallestPair(
                groups,
                groups.map(
                    (_, index) => index
                ),
                limit
            );

        if (
            !best
        ) {
            return;
        }

        mergeGroups(
            groups,
            best.left,
            best.right
        );
    }
}


// --------------------------------------------------
// BUILD ONE SUMMARY STEP
// --------------------------------------------------
// What the new node claims, and what it has to carry so that nothing the
// members held is lost:
//
//   identities   every declaration of every member, so linkFeatureSteps,
//                verify, approve and the next draft all still see them
//   rules        every member's rules, each keeping its own target, so
//                each declaration is still checked against its own claim
//   summaryOf    what was folded in, in order, so the panel can show the
//                covered steps and a violation can be traced back to the
//                one it belongs to
// --------------------------------------------------

function buildSummary(
    members,
    feature,
    id,
    callers
) {
    const ordered =
        [...members].sort(byStep);

    const memberOf =
        new Map();

    for (
        const member of ordered
    ) {
        for (
            const identity of nodeIdentities(member)
        ) {
            memberOf.set(
                identity,
                member
            );
        }
    }

    // The lead is the way in: the member nothing else in the group calls.
    // It is what the group is named after and what stands as the node's
    // own identity.
    const called =
        new Set();

    for (
        const member of ordered
    ) {
        for (
            const identity of nodeIdentities(member)
        ) {
            for (
                const caller of callers?.get(identity) || []
            ) {
                const from =
                    memberOf.get(caller);

                if (
                    from &&
                    from !== member
                ) {
                    called.add(member);
                }
            }
        }
    }

    // Every member calls another only in a cycle, and then the earliest is
    // as good an entrance as any.
    const lead =
        ordered.find(
            member => !called.has(member)
        ) || ordered[0];

    const identities =
        [];

    const addIdentity =
        value => {
            if (
                typeof value === "string" &&
                value &&
                !identities.includes(value)
            ) {
                identities.push(value);
            }
        };

    for (
        const identity of nodeIdentities(lead)
    ) {
        addIdentity(identity);
    }

    for (
        const member of ordered
    ) {
        if (
            member === lead
        ) {
            continue;
        }

        for (
            const identity of nodeIdentities(member)
        ) {
            addIdentity(identity);
        }
    }

    const lensTags =
        canonicalLenses(
            ordered.flatMap(
                member =>
                    Array.isArray(member.lensTags)
                        ? member.lensTags
                        : []
            )
        );

    const rules =
        [];

    const seenRules =
        new Set();

    for (
        const member of ordered
    ) {
        for (
            const rule of Array.isArray(member.rules)
                ? member.rules
                : []
        ) {
            const key =
                JSON.stringify(rule);

            if (
                seenRules.has(key)
            ) {
                continue;
            }

            seenRules.add(key);

            rules.push(rule);
        }
    }

    const steps =
        ordered
            .map(member => member.step)
            .filter(Number.isFinite);

    const shared =
        commonPrefix(
            ordered.map(
                member =>
                    Array.isArray(member.path)
                        ? member.path
                        : []
            )
        );

    const trail =
        shared.length > 0
            ? shared
            : Array.isArray(lead.path)
                ? lead.path
                : [];

    // A member that is itself a summary contributes the steps IT covers,
    // not itself: a reader opening a twice-folded step should see the real
    // steps, never a summary of a summary.
    const summaryOf =
        ordered.flatMap(
            member =>
                Array.isArray(member.summaryOf) &&
                member.summaryOf.length > 0
                    ? member.summaryOf.map(
                        entry => ({
                            identities: [...entry.identities],
                            title: entry.title
                        })
                    )
                    : [
                        {
                            identities:
                                nodeIdentities(member),

                            title:
                                member.title
                        }
                    ]
        );

    // --------------------------------------------------
    // THE FALLBACK TITLE
    // --------------------------------------------------
    // The lead step's own title, and how many others came with it.
    //
    // This used to be the shared part heading, which reads well once and
    // is useless in bulk: on expressjs/express one feature came out with
    // seven cards called "response" and four called "Router", and the
    // reader cannot tell any of them apart. A part name belongs in `path`,
    // where the interface already draws it - not in seven titles.
    //
    // The lead is the way into the group, so its title is the one line
    // that is certainly true of where the group starts.
    // --------------------------------------------------
    const covers =
        summaryOf.length;

    return {
        id,

        feature,

        identity:
            identities[0],

        identities,

        merge:
            "summary",

        role:
            "behaviour",

        // Replaced by the model in titleSummaries when it answers with
        // something that holds up. This is the fallback, written here so
        // that the plan this function returns is always valid on its own.
        title:
            `${lead.title} +${covers - 1} more`,

        intent:
            `Covers ${covers} steps: ${summaryOf
                .slice(0, 3)
                .map(entry => entry.title)
                .join(", ")}${covers > 3 ? "…" : ""}`,

        ...(lensTags.length > 0
            ? { lensTags }
            : {}),

        ...(rules.length > 0
            ? { rules }
            : {}),

        ...(steps.length > 0
            ? { step: Math.min(...steps) }
            : {}),

        ...(trail.length > 0
            ? { path: trail }
            : {}),

        summaryOf,

        status:
            "intended",

        origin:
            "ai_drafted",

        // linkFeatureSteps recomputes these from the call graph once every
        // summary step exists.
        edgesOut:
            []
    };
}


// --------------------------------------------------
// SUMMARISE FEATURES
// --------------------------------------------------

export function summariseFeatures(
    plan,
    {
        cap = FEATURE_STEP_CAP,
        maxSummary = MAX_SUMMARY_SIZE,
        callGraph = null
    } = {}
) {
    const nodes =
        Array.isArray(plan?.nodes)
            ? plan.nodes
            : [];

    const callers =
        callGraph?.callers || null;

    const nameOf =
        id =>
            (plan?.features || []).find(
                feature => feature?.id === id
            )?.name || id;

    // Features in the plan's own order, then anything a node claims that
    // the feature list has lost, sorted. Neither depends on the order the
    // nodes arrive in, so neither do the ids handed out below.
    const known =
        new Set(
            (plan?.features || [])
                .map(feature => feature?.id)
                .filter(
                    id =>
                        typeof id === "string" &&
                        id
                )
        );

    const extra =
        [
            ...new Set(
                nodes
                    .map(node => node?.feature)
                    .filter(
                        id =>
                            typeof id === "string" &&
                            id &&
                            !known.has(id)
                    )
            )
        ].sort();

    const featureIds =
        [...known, ...extra];

    let nextNumber =
        getNextNodeNumber(plan);

    const summaries =
        [];

    const report =
        [];

    // Which summary step each folded node became, and which node is the
    // one that puts it in the list.
    const replacedBy =
        new Map();

    const emitsAt =
        new Set();

    for (
        const featureId of featureIds
    ) {
        const inFeature =
            nodes.filter(
                node => node?.feature === featureId
            );

        const eligible =
            inFeature.filter(isEligible);

        // Everything else that still counts as a step: settled steps, and
        // anything drafted that is a behaviour but out of reach. Terms,
        // preconditions and helpers are not steps and never counted.
        const fixed =
            inFeature.filter(
                node =>
                    isBehaviour(node) &&
                    !isEligible(node)
            );

        const budget =
            Math.max(
                1,
                cap - fixed.length
            );

        const before =
            fixed.length + eligible.length;

        // A feature that already fits, and is not over the cap for any
        // other reason, has nothing to say.
        if (
            eligible.length <= budget &&
            before <= cap
        ) {
            continue;
        }

        const groups =
            [...eligible]
                .sort(byStep)
                .map(
                    node => ({
                        members: [node]
                    })
                );

        if (
            eligible.length > budget
        ) {
            foldCallTree(
                groups,
                budget,
                callers,
                maxSummary
            );

            foldSamePart(
                groups,
                budget,
                maxSummary
            );

            foldNeighbours(
                groups,
                budget,
                maxSummary
            );
        }

        // Every pass stops when no pair may merge without breaking the
        // summary limit, so still being over budget here means the limit
        // is what stopped it.
        const limited =
            groups.length > budget;

        let folded =
            0;

        for (
            const group of groups
        ) {
            if (
                group.members.length < 2
            ) {
                continue;
            }

            const node =
                buildSummary(
                    group.members,
                    featureId,
                    createId(
                        "plan",
                        nextNumber
                    ),
                    callers
                );

            nextNumber += 1;

            folded += 1;

            summaries.push({
                node,
                members: group.members,

                // The feature's NAME, for the titling prompt. It used to
                // send node.feature, which is the id: a model asked to
                // name a step in "feat_0003" has been told nothing.
                featureName:
                    nameOf(featureId)
            });

            for (
                const member of group.members
            ) {
                replacedBy.set(
                    member,
                    node
                );
            }

            emitsAt.add(
                group.members[0]
            );
        }

        const after =
            fixed.length + groups.length;

        const overflow =
            Math.max(
                0,
                after - cap
            );

        // A feature left over the cap says WHY, in the words of whichever
        // constraint actually stopped it. Both can be true at once.
        const because =
            [
                fixed.length > 0
                    ? `${fixed.length} settled steps`
                    : null,

                limited
                    ? `no summary step may cover more than ${maxSummary}`
                    : null
            ].filter(Boolean);

        report.push({
            feature:
                featureId,

            name:
                nameOf(featureId),

            before,

            after,

            summaries:
                folded,

            settled:
                fixed.length,

            overflow,

            limited,

            line:
                `${nameOf(featureId)}: ${before} steps → ${after} (${folded} summary steps)` +
                (
                    overflow > 0 && because.length > 0
                        ? ` — still ${overflow} over the cap of ${cap}: ${because.join(", and ")}`
                        : ""
                )
        });
    }

    const out =
        [];

    for (
        const node of nodes
    ) {
        const summary =
            replacedBy.get(node);

        if (
            !summary
        ) {
            out.push(node);

            continue;
        }

        // The summary takes the place of its earliest member, and the rest
        // of the members leave the list.
        if (
            emitsAt.has(node)
        ) {
            out.push(summary);
        }
    }

    return {
        nodes: out,
        summaries,
        report
    };
}


// --------------------------------------------------
// TITLE THE SUMMARY STEPS
// --------------------------------------------------
// One request per fifteen steps, and only ever the titles, intents and
// names already in the plan - never a file and never a line of source.
//
// Everything that comes back is checked before it is kept, to the same
// standard a drafted title is held to. A title that fails, a step the
// model skipped, a reply that will not parse and a run with no model at
// all all end the same way: the deterministic fallback summariseFeatures
// already wrote stays, and the run says so. Naming a group badly is worth
// reporting; it is not worth failing a draft over.
// --------------------------------------------------

// --------------------------------------------------
// A TITLE MUST NOT NAME A FUNCTION
// --------------------------------------------------
// But only a name that READS as a function. This was a case-insensitive
// substring match over every declaration name, which meant a group
// holding functions called save, get, score or submit rejected every
// ordinary title written about them: "Save all answers together" was
// refused because one of its members is called save, and the group fell
// back to a worse title than the model had offered.
//
// A name earns the check by being code-shaped - it carries an underscore,
// a dot, parentheses, or an internal capital - and then it is matched as a
// whole word. A plain English word is always allowed in a title, whatever
// the code happens to call a function.
// --------------------------------------------------

function isCodeShaped(
    name
) {
    return (
        /[_.()]/.test(name) ||
        /[a-z][A-Z]/.test(name)
    );
}


function memberNames(
    summary
) {
    const names =
        new Set();

    for (
        const identity of summary.node.identities || []
    ) {
        const name =
            declarationName(identity);

        if (
            typeof name !== "string" ||
            !name
        ) {
            continue;
        }

        // The whole name, and each dotted segment on its own, so
        // Store.agency_risk_for_scope is caught by either half.
        for (
            const part of [name, ...name.split(".")]
        ) {
            if (
                part.length >= 3 &&
                isCodeShaped(part)
            ) {
                names.add(part);
            }
        }
    }

    return [...names];
}


function namesFunction(
    title,
    name
) {
    const escaped =
        name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

    // A word boundary written out, because \b is defined over word
    // characters and a name may end in a bracket.
    return new RegExp(
        `(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`,
        "i"
    ).test(title);
}


function buildTitlePrompt(
    batch
) {
    const steps =
        batch
            .map(
                summary => {
                    const covers =
                        summary.members
                            .map(
                                member =>
                                    `  - ${member.title}\n` +
                                    `    intent: ${member.intent}\n` +
                                    `    named: ${nodeIdentities(member)
                                        .map(
                                            identity =>
                                                identity.split("::")[1] || identity
                                        )
                                        .join(", ")}`
                            )
                            .join("\n");

                    return (
                        `key: ${summary.node.id}\n` +
                        `feature: ${summary.featureName || summary.node.feature}\n` +
                        `part: ${headingOf(summary.node) || "(none)"}\n` +
                        `covers:\n${covers}`
                    );
                }
            )
            .join("\n\n");

    return `
You are naming summary steps in a PlanMap development plan.

Each step below already exists. It stands for several smaller steps that
were folded together to keep its feature readable. Give each one a TITLE
and an INTENT that are true of the whole group - not of its first member.

${BEHAVIOUR_LINE}

THE INTENT is one sentence, and it has to hold for every step listed under
the key. If the only sentence true of all of them is "several things
happen", the group is telling you its members have nothing in common - say
what they are all part of instead.

NEVER put a function name in a title. The names are given below so that you
know what the group is about, not so that you can repeat them.

Answer with JSON and nothing else:

{ "steps": [ { "key": "...", "title": "...", "intent": "..." } ] }

One entry per key, using the key exactly as written.

STEPS

${steps}
`;
}


function titleProblem(
    answer,
    summary
) {
    if (
        !answer
    ) {
        return "the model did not answer for this step";
    }

    const title =
        typeof answer.title === "string"
            ? answer.title.trim()
            : "";

    if (
        !title
    ) {
        return "empty title";
    }

    if (
        title.split(/\s+/).length > 12
    ) {
        return "title is over 12 words";
    }

    if (
        PLACEHOLDER_VERBS.test(title)
    ) {
        return "title opens with a placeholder verb";
    }

    const named =
        memberNames(summary).find(
            name =>
                namesFunction(
                    title,
                    name
                )
        );

    if (
        named
    ) {
        return `title names the function ${named}`;
    }

    if (
        !(
            typeof answer.intent === "string" &&
            answer.intent.trim()
        )
    ) {
        return "empty intent";
    }

    return null;
}


export async function titleSummaries(
    summaries,
    {
        call = null,
        chunk = TITLE_CHUNK
    } = {}
) {
    // { id, reason } rather than one sentence, so a run where every
    // summary step failed for the SAME reason - the model was unreachable,
    // typically - can say it once with a count instead of printing 36
    // identical lines.
    const fallbacks =
        [];

    const list =
        Array.isArray(summaries)
            ? summaries
            : [];

    if (
        list.length === 0
    ) {
        return { fallbacks };
    }

    if (
        typeof call !== "function"
    ) {
        for (
            const summary of list
        ) {
            fallbacks.push({
                id: summary.node.id,
                reason: "no model configured"
            });
        }

        return { fallbacks };
    }

    for (
        let start = 0;
        start < list.length;
        start += chunk
    ) {
        const batch =
            list.slice(
                start,
                start + chunk
            );

        let parsed;

        try {
            parsed =
                await call(
                    buildTitlePrompt(batch)
                );
        } catch (error) {
            for (
                const summary of batch
            ) {
                fallbacks.push({
                    id: summary.node.id,
                    reason: error.message
                });
            }

            continue;
        }

        const byKey =
            new Map();

        for (
            const step of Array.isArray(parsed?.steps)
                ? parsed.steps
                : []
        ) {
            if (
                typeof step?.key === "string"
            ) {
                byKey.set(
                    step.key,
                    step
                );
            }
        }

        for (
            const summary of batch
        ) {
            const answer =
                byKey.get(summary.node.id);

            const problem =
                titleProblem(
                    answer,
                    summary
                );

            if (
                problem
            ) {
                fallbacks.push({
                    id: summary.node.id,
                    reason: problem
                });

                continue;
            }

            summary.node.title =
                answer.title.trim();

            summary.node.intent =
                answer.intent.trim();
        }
    }

    return { fallbacks };
}
