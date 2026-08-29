# PlanMap — FC Build interview pack

Everything they can ask, answered the way you'd actually say it out loud. Short, plain, confident.
Memorise §1, §3, §4. Skim the rest so nothing surprises you.

---

## 0. Who you're talking to (read this first — it changes everything)

**FC Build is Foundation Capital's accelerator.** Foundation Capital is a VC that's been backing
founders for 30+ years. The program is free, takes no equity, runs 16 weeks in person in SF, and
takes 8–12 founders a cohort. You get $1M+ in credits (AWS, Azure, OpenAI, Anthropic), free SF
office space, and intros into their ~200-investor network.

**Four things that should shape every answer:**

1. **Their stated bar is "a sharp insight into a problem" and "exceptional pace of execution,
   week to week."** Those are literally the two criteria. Your 30-day story isn't a nice extra —
   it's the main event. Lead with it.
2. **They back founders "from day zero," before product or revenue.** So you having no users is
   *expected*, not a weakness. Do not be apologetic about it. Say it flatly and move on.
3. **They focus on B2B.** So do *not* open with "it's a free tool for solo developers." Open with
   companies. The free tier is how you get in the door; the business is teams and enterprises
   paying to know their code matches what they approved.
4. **This is a VC.** Free program, but they're deciding whether you're someone they'd fund later.
   Expect YC-style questions. Answer like a founder, not a student.

**One-line reframe of your whole pitch for this room:**
*"Companies are about to have more code written by machines than by people, and no way to prove any
of it still matches what they decided. I'm building that proof."*

---

## 1. The pitch

### The one-liner

> **PlanMap is Figma for backend engineering — a shared map of how your system actually works.
> Except you don't draw it. It draws itself from your code, and it tells you the second the code
> stops matching the plan.**

### 30 seconds (memorise word for word)

> "Designers have Figma. Everyone sees the whole product, agrees on it, changes it together.
> Backend engineering has nothing like that. It lives in people's heads and old diagrams.
>
> PlanMap is that map, and it builds itself. You point it at a repo, it reads the code and draws
> the system. Then it does two things nothing else does. You click any piece and it tells you
> exactly what else breaks if you change it. And when someone changes the code without changing the
> plan, it flags it and fails your build.
>
> The reason now is AI. Agents can read your whole repo, but they can't see what breaks. They have
> text, not a map. I'm building the map — for the agent and for the human."

### If they say "keep going"

> "Three things, quickly.
>
> One — the failure isn't that agents write bad code. They write *correct* code with missing
> context. It does exactly what you asked and breaks something three files away.
>
> Two — the reason *why* dies. Somebody decided the login session lasts 30 days on purpose. That
> reasoning lived in a chat window. Six weeks later an agent sets it to 24 hours, nothing errors,
> tests pass, and nobody can trace the support tickets back to it.
>
> Three — the rule that makes people trust it: a code parser decides what breaks, the AI only
> writes the sentence explaining why. Parsers don't make things up. If I'm confidently wrong about
> 'this will break' even twice, nobody opens it again."

### Defending the Figma line

They'll poke at it. Get ahead of it:

> "Where the comparison breaks is the good part — Figma is hand-drawn, and anything hand-drawn goes
> stale. Mine draws itself and then checks itself against reality. So it's Figma that yells when
> the build doesn't match the design."

**If they say "so it's a diagram tool":**

> "Diagram tools are a graveyard. CodeSee raised $10M drawing codebases and shut down in 2024. A
> picture isn't a business. The picture is the front door — the product is the thing that tells you
> what breaks, and the check that fails your pull request."

---

## 2. The 30-day story — your strongest card

FC's bar is *pace of execution*. This is the answer to that. Have it ready even if they don't ask.

> "Thirty days ago this didn't exist.
>
> **Week one** I went looking for what AI coding is *breaking*, not what it's fixing. Two things
> kept coming up: agents change one thing and break another they couldn't see, and the reasoning
> behind decisions disappears into chat. Then I checked whether that was real or just vibes.
> Google's DORA report — 90% of engineers use AI, throughput is up, and *stability keeps getting
> worse*. Over 60% have found AI-introduced bugs after they shipped.
>
> **Week two** I tried to kill the idea. The obvious version is a big map of your whole company, and
> I went and read how that ends. ServiceNow's version rotted for twenty years. Backstage catalogs
> famously never get finished. CodeSee died. So I wrote the document arguing against my own idea
> before I wrote any code — ranked the ways it dies — and then cut the scope down to one repo.
>
> **Weeks three and four** I built it. 41 commits, about 5,300 lines, 128 tests passing, working on
> Mac, Linux, and Windows. The whole loop runs today."

**The closing line:** *"So what I've got after 30 days isn't a deck. It's a working engine and a
document explaining how it dies."*

---

## 3. The YC question bank — every one, answered

### "What are you making?"

> "A map of how your software works that builds itself from your code, tells you what breaks before
> you change something, and catches it when the code stops matching what your team agreed on."

### Your numbers

**Know these cold. Yours are build numbers, not business numbers — that's fine at day zero.**

| | |
|---|---|
| Users | Zero. Pre-launch. Built the engine first |
| Revenue | Zero |
| Days since first commit | ~22 days of building, 30 since ideation |
| Commits / lines / packages | 41 / ~5,300 / 7 |
| Tests | 128, all passing, green on Mac + Linux + Windows |
| Languages supported | TypeScript, JavaScript, Python |
| Cost to run | Roughly nothing. Runs on your laptop. No servers, no model costs — users bring their own AI key |

**How to say it:**
> "Zero users, zero revenue — I've spent the last month building the engine rather than a landing
> page. What I do have is a working product with 128 tests and a fixture repo that proves the
> accuracy claim automatically on every commit. Getting it in front of real developers is exactly
> what the next 90 days are for."

Then immediately pivot to §11 (what you'd do with the program). Don't sit in the silence.

### Value prop

**"Who needs this?"**
> "Three people. The engineer who's afraid to change something because they don't know what it
> touches. The team lead who wants to know an agent didn't quietly undo a decision they made. And
> the new hire on day one who has no idea how any of it fits together."

**"What's new about it?"**
> "Two things. It builds itself — nobody maintains it, which is why every previous version of this
> died. And the AI is deliberately not allowed to decide anything. A parser decides what breaks;
> the AI only writes the explanation. Everybody else does it the other way around, and that's why
> nobody trusts their answer."

**"What do users want most?"**
> "'Tell me what breaks if I change this.' That's the one. The map is how you find the thing to
> click; the answer is the product."

**"What are they doing now?"**
> "Asking the senior engineer. Grepping. Reading a wiki that's a year out of date. Or just
> shipping it and finding out."

**"How does it work, in more detail?"**
> "You point it at a repo. It reads the code with a real compiler — not guesses — and builds a
> graph of what calls what. That becomes the map. When you change something, it walks the graph
> backwards and lists everything that depends on it. And each piece remembers a fingerprint of the
> code it's linked to, so when that code changes and the plan didn't, it flags it."

### Market size

**"How big is the market?"**
> "The AI coding tools market is around $8 billion this year, growing north of 20%. But I'll be
> straight with you — that number counts tools that *write* code, and I don't write code. My
> serviceable slice is more like half a billion to a billion a year, and honestly the more useful
> answer is that this category doesn't have a budget line yet. That's the opportunity and the risk
> in the same sentence."

*Saying that costs you nothing and buys a lot. Investors notice who launders numbers.*

**"How fast is it growing?"**
> "20-plus percent on the code tools side. The platform engineering side — where the enterprise
> version lands — is about $8 billion growing 24%. Gartner said 80% of large engineering orgs would
> have platform teams by 2026, and that's happened."

**"Who are your competitors?"**
> "Everybody owns one slice and nobody owns the whole thing. Firefly does cloud infrastructure.
> Port and Cortex do service catalogs. Sourcegraph does code search. GitHub's Spec Kit does
> markdown specs. Cursor and Claude Code have a plan mode, but it's a chat message that disappears.
> Nobody connects code to what a human actually approved and then checks it."

**"Which do you fear most?"**
> "Port. They raised $100M at $800M in December specifically to become the place agents act on your
> company's map. Same instinct as me, way more money. What they don't have is the code layer —
> they're a service catalog. But if they buy or build the code piece, that's the fight."

**"How many users / how much revenue do competitors have?"**
> "Cursor's around $2 billion in revenue. Claude Code's in the billions. GitHub's Spec Kit is free
> and has 90,000-plus stars. Port raised $100M at $800M, Cortex $60M. It's a well-funded
> neighborhood — which is the good news. It means people pay for things near this."

**"How much time and money do people waste before switching to you?"**
> "The clean number is rework. GitClear looked at 211 million changed lines and found duplicated
> code jumped 8x in 2024 while refactoring collapsed from a quarter of all changes to under 10%.
> That's engineers doing work twice. On the onboarding side it's weeks per hire, every hire."

**"What are the trends?"**
> "Everyone building a catalog or map is racing to make it populate automatically, because they've
> all discovered nobody fills them in by hand. Cortex has an AI importer, OpsLevel has one,
> ServiceNow bolted AI onto their 20-year-old product to find stale records. They're all admitting
> the same thing: auto-population is the hard part. I started there instead of ending there."

### User acquisition

**"Who's your first paying customer?"**
> "A small engineering team that's already been burned — where an agent broke something and it took
> them days to work out why. Probably 5 to 30 engineers, moving fast, using Claude Code or Cursor
> daily. They'd pay for the CI check that fails a pull request when the code stops matching what
> they approved."

**"How do you get users?"**
> "Bottom-up. It's free, it runs on your laptop, there's no signup and no procurement. One engineer
> installs it because they're scared of breaking something. Then they want their team to see the
> same map, and that's the paid tier. It's the same path Port and Cortex actually walked."

**"How do they know they need it?"**
> "They already know. Every engineer using an agent has a story about it breaking something
> unrelated. I don't have to teach the pain, just show up with the answer."

**"How will they find you?"**
> "Open source and the developer channels — Hacker News, the AI coding subreddits, the Claude Code
> and Cursor communities. Spec Kit went from zero to 90,000 stars in nine months on markdown files.
> That distribution channel is proven and it's free."

**"What makes them try it?"**
> "It takes one command and no account. That's the whole bet — the cost of trying it is 30 seconds."

**"What makes them reluctant?"**
> "Two things. 'Another tool.' And 'I don't believe it'll be right.' The first one I beat by never
> asking them to leave their editor and never asking them to fill anything in. The second is the
> real one — which is why the accuracy test is the demo. I show it correctly *refusing* to flag
> something."

### Execution

**"What's the most impressive thing you've done?"**
> "For this — went from an idea to a working engine with 128 tests in about three weeks, on my own,
> while taking classes.
>
> Outside of it — I lead the aeronautics side of Stanford's Space Initiative. We fly payloads to
> 80,000 feet, and we did a satellite prototype with a NASA autonomy engineer. And I won Stanford's
> CS109 probability challenge — top project out of 500-plus students."

**"Tell us something surprising."**
> "How many dead bodies are in this category. I went looking for open space and found four
> predecessors that failed — CodeSee, ServiceNow's CMDB, Backstage catalogs, half of all platform
> engineering teams. They all died the same way: the map was hand-maintained, so it went stale, so
> people stopped believing it. That completely changed the product. Auto-population went from being
> a feature to being the constraint everything else is designed around."

**"What's the biggest mistake you've made?"**
> "I designed the whole thing before I'd talked to enough developers. I have a really rigorous set
> of planning documents built on published research, and about 30 days of building — and not enough
> conversations. I know that's backwards, and it's the first thing I'd fix."

*(Say this only if it's true. It's a strong answer because it's the same thing they're about to
criticise, and you got there first.)*

### Founder-market fit

**"Why this idea?"**
> "Because I keep running into the same thing in different forms. I do systems engineering with
> Stanford's Space Initiative — trade studies where you change the thermal design and have to know
> what it does to power and comms *before* you commit. Last summer I built the planning system for
> Jio's 5G buildout — 5,000 cell sites, deciding what to build before building it. And in the lab
> I work in, I replaced everyone's one-off analysis scripts with shared infrastructure.
>
> Same pattern three times. The expensive mistake isn't the build, it's committing without knowing
> what it touches. Software is the one place where we just… don't check."

**"Why are you uniquely qualified?"**
> "Honestly, I'm not going to claim a credential here. Thirty days ago I hadn't written a line of
> static analysis. What I'd point at instead is that in 30 days I built a working dependency engine
> on the TypeScript compiler, a Python analyzer, a drift detector, and 128 tests — including tests
> for things it must *not* flag.
>
> And the hard part here isn't the parser. Parsers are a solved API. The hard part is judgment about
> what to refuse to claim, and that's what physics and probability training is actually for."

**"Why dedicate your life to this?"**
> "Because I think we're about to lose something. Software's always been understandable by the
> people who built it. That's ending — machines are writing more of it than we can read. Either we
> build the layer that keeps it understandable, or in five years nobody can say what their own
> systems do. I'd like to be working on that."

### Growth potential

**"How do you make money?"**
> "Free for one person on their own repo. About $19 a seat a month for a team — shared plans, the
> approval step, the CI check. Custom pricing for enterprises who need it across the whole company
> with audit and access control. And I never charge for AI usage — people bring their own key.
> That's deliberate: Kiro tried usage pricing last year, got called a 'wallet-wrecking tragedy,'
> and had to refund people."

**"How much could you make a year?"**
> "The seat math: there are roughly 25 million developers, about 90% use AI tools. If 10% of those
> ever pay for something like this at $20 a month, that's a few billion in theory and a few hundred
> million realistically. But the bigger number is enterprise. Once this is the system of record for
> 'does our software match what we approved,' it's a compliance line item, and those are 50 to 100k
> a year per company, not per seat."

**"How does this become a billion-dollar company?"**
> "Two steps. First it's the tool an engineer installs so they don't break things — that gets me
> distribution. Then it becomes the thing a company *has* to have, because when most of your code
> is written by agents, somebody has to be able to prove it still matches what you decided. That's
> not a productivity tool anymore, that's a control. Controls get bought by the company, not the
> engineer, and they don't churn."

**"What else could you expand into?"**
> "The map isn't just for code. Same engine covers your database schema, your cloud setup, your
> CI — that's the enterprise version. Beyond that, the same map explains your system to non-
> engineers: sales, product, execs. And ultimately it's what an agent reads before it does
> anything, so it doesn't act blind."

### Team

**"Are you solo?"**
> "Solo right now. I've been carrying the technical risk fine — 30 days, working engine. The risk
> I'm not carrying well is distribution, and that's who I'd want next: someone who lives in
> developer communities. That's honestly one of the things I'd want from this program."

**"Who's the boss?"** — *If solo:* "Me, and I'm aware that's not a permanent answer."

**"Who's your next hire?"**
> "Not an engineer. Someone on distribution — developer community and go-to-market. I can build
> faster than I can get people to try it, and that's the actual constraint."

**"How do we know your team will stick together?"** — *If solo, deflect honestly:* "Can't answer
that yet. What I can tell you is I've shipped 41 commits in 22 days alongside a full course load,
so the question of whether *I* stick with it is already answered."

### Misc

**"What's the rocket science here?"**
> "Two hard parts. The obvious one is being precise enough — I track individual functions, not just
> files, which is why it correctly *doesn't* flag a file that happens to contain a different
> function. File-level analysis would get that wrong.
>
> The less obvious one is restraint. It would be really easy to have the AI guess at everything and
> look magical. I've architecturally banned that. The AI can't add or remove anything from the
> answer — it only writes the explanation. That's a harder product to build and it's the only
> version anyone will trust."

**"What are you building first?"**
> "Already built it — the engine and the CLI. Next is getting 20 developers running it on real code,
> and shipping the CI check as a GitHub Action. That's the smallest thing that becomes a habit."

**"What have you learned so far?"**
> "That the graveyard matters more than the market. And that I should be leading with impact
> analysis, not the map. People don't want a picture, they want an answer to 'what breaks?'"

**"Why isn't someone already doing this?"**
> "Two reasons, and I think they're both structural.
>
> The people best positioned can't. Cursor, GitHub, and Anthropic all want you inside their tool.
> You can't credibly be the neutral referee grading every agent's work while you *are* one of the
> agents. GitHub actually tried the planning product — Copilot Workspace — and shut it down last
> May.
>
> And the people who tried the visual version tried it too early. CodeSee was building this before
> agents existed, when you still had to draw the map by hand. Reading a codebase well enough to draw
> itself only got good recently."

**"What do outsiders not understand about your field?"**
> "That being wrong is way worse than being incomplete. If I miss three dependencies, you're
> annoyed. If I confidently tell you something will break and it doesn't — once or twice — you never
> open it again, because you *acted* on it. Everyone building AI dev tools optimizes for looking
> impressive. This category punishes that."

**"What keeps you up at night?"**
> "False positives. One confidently wrong answer costs more than a hundred missing ones."

**"What obstacles will you hit?"**
> "Getting developers to install a new thing — that's the big one. And staying accurate as I add
> languages; every new language is a new chance to be wrong. I'd rather say 'I'm not sure' than
> guess, and I've built that in from the start."

**"Six months from now, what's your biggest problem?"**
> "Distribution, not technology. In six months the engine will be genuinely good. The question will
> be whether anyone's using it, and that's a completely different muscle than the one I've been
> using."

**"Are you open to changing the idea?"**
> "Yes, and I can tell you exactly what would change it. My biggest bet is that a visual map beats
> plain markdown files. Every tool in this space today is markdown, and Spec Kit got 90,000 stars
> on markdown. If developers don't come back to the map on their second and third feature, I drop
> it and this becomes a markdown-first tool that just does impact analysis and the CI check. And
> honestly, that's still a good product."

**"Have you considered [some twist]?"**
> Whatever they suggest — engage with it genuinely, then say what it would cost. *"That's
> interesting. The thing I'd worry about is ___. What would make me try it is ___."* Never dismiss
> it, never instantly agree. They're testing whether you think or perform.

**"What's the funniest thing that's happened?"**
> Have something human ready. They ask this to see if you're a person. Don't over-plan it.

---

## 4. The demo — 3 minutes, do it if they let you

1. Run it on the example repo. *"No setup, no config. It read the code and drew the map."*
2. Open the app, switch views. *"The picture's the front door, not the product."*
3. Ask what breaks if you change the token-checking function. *"Login and checkout break. And notice
   what it says nothing about — there's another file right next to login that uses a different
   function. It correctly leaves it alone. That's a compiler, not a guess. There's zero AI in that
   answer."*
4. Approve it, change the code in another window, re-run the check. *"Flagged, with the original
   reasoning still attached, and the build fails. That's the whole product in one screen."*

**The line that sells it:** point at what it *didn't* flag. Anyone can produce a list. Producing a
correct short list is the hard part.

---

## 5. The gap, if they want the competitive picture

| Who | What they own | What they miss |
|---|---|---|
| Firefly | Cloud infrastructure | Code, database, intent |
| Port ($100M @ $800M), Cortex | Service catalog | The code layer |
| Sourcegraph | Code search | Cloud, database, intent |
| Spec Kit, Kiro, OpenSpec | Markdown specs | No impact, no drift, no map |
| Cursor, Claude Code | A plan in chat | Nothing persists, nothing checks |
| DeepWiki | Explains your code | Doesn't decide, doesn't verify |

> "Everybody owns one layer. Nobody connects the code to what a human approved and then keeps
> checking it."

---

## 6. The technical bit — keep it short unless they dig

Four sentences is usually enough:

> "It reads your code with the actual TypeScript compiler, so the dependencies are facts, not
> guesses. It tracks individual functions, not just files, which is what stops false positives.
> Each piece of the map stores a fingerprint of the code it's linked to, so drift is a fingerprint
> comparison — instant, free, and no AI involved. The AI only ever writes the sentence explaining
> why, and it can't change the answer."

**If they actually dig, here's the depth in plain terms:**

- **Why functions and not files.** Two functions can live in the same file. If you only track files,
  changing one flags everything that touches the other — false positives. I match on the exact
  function name for the first hop.
- **Certain vs. probably.** If something calls your function directly, that's certain. If it's two
  or three steps away, it's marked as inferred and shown differently. The parser decides that, not
  a model rating its own confidence.
- **Why reformatting isn't a false alarm.** The fingerprint ignores whitespace. Running a formatter
  doesn't trigger anything. That one detail is the difference between a useful check and a noisy
  one people switch off.
- **Nothing can drift unless a human approved it.** No approval, no alarm. And when you fix the
  code, the flag clears itself. A warning that only ever piles up is one people learn to ignore.
- **Adding languages doesn't touch the engine.** Each language has its own reader that produces the
  same normalised facts. TypeScript and Python are in. Go is one new file.
- **It works with no AI at all.** Today there's no model wired in and every answer is still correct.
  That's the design, not a shortcut.

**What isn't built yet — say these before they find them:**
- The AI explanation layer isn't wired up. The engine works without it.
- Two languages, not ten.
- The database + cloud version is designed, not built.
- Nobody's used it yet.

---

## 7. Your background — the 25-second version

> "I'm a junior at Stanford, physics on the computational track, starting a coterm master's in CS
> next year on the AI track.
>
> Most of what I've done is systems. I lead aeronautics for Stanford's Space Initiative — high
> altitude payloads, and a satellite prototype with a NASA engineer, where the whole job is 'if I
> change this, what happens to everything else.' Last summer at Jio I built the planning system for
> their 5G rollout — 5,000 cell sites, figuring out what to build before building it. And at
> Stanford's Human Perception Lab I replaced the lab's one-off scripts with shared infrastructure
> that a few studies now run on.
>
> That's the same thing three times. PlanMap is that, for software."

**Backup facts if you need them:** CS109 probability challenge winner, top of 500+ students.
Published research, national fair finalist. 3.914 GPA. One clause each, then move on — they don't
care about grades, they care whether you ship.

**If they push on "you're not a devtools person":** see §3, "Why are you uniquely qualified." Don't
argue the credential. Point at the artifact and reframe: *"the hard part isn't the parser, it's
knowing what to refuse to claim."*

---

## 8. ⚠️ The question you're most likely to get caught on

You told them you spent 30 days asking developers and startups about their gaps. **They will ask
who you talked to.** Right now the repo can back up the research and the build — not the
conversations.

**Best case: go do 5–10 conversations before the interview.** Engineers who use Cursor or Claude
Code daily, a startup CTO, someone who joined a team recently. Three questions, write down what they
actually say:

1. "Tell me about the last time an AI agent changed something and broke something else."
2. "Where does the reasoning behind an architecture decision live at your company?"
3. "How long before a new engineer can safely change something on their own?"

One verbatim quote from a real engineer beats every statistic in this document. If you get even
eight of these, open your answer with one.

**If you haven't done them, say it clean:**

> "Informal so far — engineers around Stanford, people I've worked with, plus reading the primary
> research instead of vendor blogs. What I haven't done is structured discovery, and I know that's
> the gap. It's honestly the first thing I'd want from the program: I have a working engine and I
> need to put it in front of 20 developers and find out whether what I built is what they'd keep."

Do not fake data. They're very good at spotting it, and it's the one thing you can't recover from.

---

## 9. Numbers to memorise — six is plenty

- **90%** of engineers use AI tools — and delivery stability keeps getting *worse* (Google DORA 2025)
- **Over 60%** have found AI-introduced bugs *after* shipping; ~30% don't trust AI code
- **8x** more duplicated code in 2024; refactoring fell from 25% of changes to under 10% (GitClear,
  211M lines)
- **~$8B** AI coding tools market, 20%+ growth — *say out loud that it counts code generation, not
  what you do*
- **Port raised $100M at $800M** in Dec 2025 — people pay for things near this
- **CodeSee raised ~$10M and shut down in 2024** — and here's why I'm different

When a number is shaky, say so. *"That one's from a vendor blog, so treat it as directional."* It
costs nothing and it's memorable.

---

## 10. What not to say

| Don't | Do |
|---|---|
| "It's like Cursor but better" | "It's the layer above Cursor. It never writes code." |
| "We use AI to analyse your codebase" | "A parser decides what breaks. The AI just writes the explanation." |
| "Figma for code" | "Figma for backend engineering and architecture — and it draws itself." |
| "It visualises your architecture" | "It tells you what breaks before you change it." |
| "The market is $8 billion" | "$8B counts code generation. My real slice is smaller, and nobody has a budget line for it yet." |
| "No one else is doing this" | "Everybody owns one layer. Nobody connects them." |
| "It's free for developers" *(to a B2B investor)* | "Free is how I get in. Teams and enterprises are the business." |
| Long technical answers | Four sentences, then stop. Let them ask. |
| Apologising for zero users | "Zero users — I built the engine first. Here's what the next 90 days look like." |

**The single biggest delivery note: stop talking sooner than feels comfortable.** Short answers read
as confidence. Long ones read as nerves. If they want more they'll ask — they always do.

---

## 11. What you want from FC Build

They'll ask. Have three specific things, not "mentorship and network":

1. **Users.** 20 developers running it on real repos. My biggest open question can only be settled
   by real usage, and Foundation Capital's portfolio is full of exactly the right companies.
2. **A distribution cofounder or first hire.** I can build faster than I can get people to try it.
3. **Pressure on one decision.** After I get first signal: do I go deeper on languages, or go build
   the team version with the CI check and start charging? I want that argued by people who've made
   the call before.

**"How much time will you give this?"** — Don't hedge, give a number, then point at the git log:
41 commits and a working engine in three weeks alongside a full course load. Confirm you can be in
SF in person for the program.

**"What ships in 90 days?"**
> "Wire up the AI explanation layer. Get 20 developers using it on real code. And ship the CI check
> as a GitHub Action — that's the smallest version of this that becomes a habit instead of a demo."

---

## 12. How to close

Pick one, say it slowly, then stop.

> "Everyone's racing to make software get written faster. I'm building the thing that keeps someone
> able to say what it's supposed to do — and prove it still does."

> "Agents can read every file in your repo and still not know what breaks. I'm building the thing
> that knows."
