// --------------------------------------------------
// SIBLING FAMILIES
// --------------------------------------------------
// Declarations that are one behaviour written several times over, once per
// thing it applies to:
//
//   get_agencies    get_mps    get_districts    get_states
//
// Four declarations, one behaviour, four nouns. Drawn as four steps they
// cost the reader four rows to learn one thing, and the only difference
// four rows can show is the part that was never the point.
//
// WHY THIS IS DETECTED RATHER THAN ASKED FOR. The draft prompt asked the
// model to notice these itself and it did not, on a project full of them:
// a real run over 183 declarations produced zero merges. Noticing that four
// names out of thirty differ by one word is the kind of thing static
// analysis is reliably good at and a model reading prose is not, so PlanMap
// does it and offers the family as a proposal - the same bargain as the
// feature, the lens and the role.
//
// A family is a CANDIDATE, never a decision. The model says whether the
// four are really one behaviour, and the merge gate in draft.js then checks
// that one assert is true of all of them before any merging happens.
// --------------------------------------------------

import { declarationName, splitWords } from "../llm/roles.js";

// Below this, "a family" is just two things that rhyme. Two is enough to be
// a real pair - get_agencies and get_mps - so the bar is low on size and
// high on likeness.
const MIN_FAMILY = 2;

export function siblingFamilies(
    declarations
) {
    const list =
        Array.isArray(declarations)
            ? declarations.filter(
                declaration =>
                    typeof declaration?.identity === "string"
            )
            : [];

    // Every way each declaration could belong to a family: its name with one
    // word blanked out. Two names that agree on everything but one position
    // land in the same bucket.
    const buckets =
        new Map();

    for (
        const declaration of list
    ) {
        const words =
            splitWords(
                declarationName(
                    declaration.identity
                )
            );

        // One word cannot differ by one word and still be the same shape.
        if (
            words.length < 2
        ) {
            continue;
        }

        for (
            let index = 0;
            index < words.length;
            index++
        ) {
            // The file and the parameter count come into the key because a
            // family is written in one place, to one signature. Without
            // them "run" in six unrelated modules is a family.
            const key = [
                declaration.file || declaration.identity.split("::")[0],
                declaration.kind || "",
                Number(declaration.properties?.params) || 0,
                index,
                words.map(
                    (word, position) =>
                        position === index
                            ? "*"
                            : word
                ).join("|")
            ].join("::");

            if (
                !buckets.has(key)
            ) {
                buckets.set(
                    key,
                    []
                );
            }

            buckets.get(key).push({
                identity: declaration.identity,
                varying: words[index]
            });
        }
    }

    // A declaration can sit in several buckets - one per word position. The
    // largest is the family it most belongs to; ties go to the earliest
    // position, which is the leading word and usually the real subject.
    const best =
        new Map();

    for (
        const members of buckets.values()
    ) {
        const unique =
            [...new Map(
                members.map(
                    member => [member.identity, member]
                )
            ).values()];

        if (
            unique.length < MIN_FAMILY
        ) {
            continue;
        }

        for (
            const member of unique
        ) {
            const current =
                best.get(member.identity);

            if (
                !current ||
                unique.length > current.members.length
            ) {
                best.set(
                    member.identity,
                    {
                        members: unique,
                        varying: member.varying
                    }
                );
            }
        }
    }

    // Keyed by identity, holding the others in its family and the words that
    // tell them apart - the nouns a merged step would be read across.
    const families =
        {};

    for (
        const [identity, found] of best
    ) {
        families[identity] = {
            siblings: found.members
                .filter(
                    member =>
                        member.identity !== identity
                )
                .map(
                    member => member.identity
                ),

            varies: found.members.map(
                member => member.varying
            )
        };
    }

    return families;
}
