// --------------------------------------------------
// THE BEHAVIOUR LINE
// --------------------------------------------------
// Every human-readable line PlanMap generates - a plan node's title, each of
// its four readings, and an outline label - is written to one standard, and
// this is it. It lives in one place because the three were drifting apart:
// titles had a ban list, readings had none, and readings were where the
// vague lines came from.
//
// The failure it exists to stop is a line with a real verb and an empty
// object - "Process the send", "Handle the saving", "Wait for write". Each
// names an activity and never says what the activity is done TO, so the
// reader learns nothing and three in a row look like one node repeated.
//
// EVERY EXAMPLE HERE IS FROM A PARCEL-DELIVERY PROJECT, ON PURPOSE. An
// earlier version of this file taught with survey and auth examples - the
// domain most projects it runs on happen to be in - and the model copied
// them into its answers verbatim: ten of sixty-six lines in one draft were
// sentences lifted straight out of the prompt. Examples have to be far
// enough from the project under analysis that copying one is obviously
// wrong. If you edit this file, keep them in a domain PlanMap will not be
// pointed at.
// --------------------------------------------------

export const BEHAVIOUR_LINE = `
Write it as VERB + OBJECT, and add ONE qualifier only when it changes the
meaning. Three to eight words.

  verb      what the system does: submit, verify, record, reject, render,
            read, issue, hide, answer
  object    the thing it does that to, NAMED
  qualifier only when it distinguishes: "before the van leaves", "on page
            load", "in one transaction"

The examples below are from a parcel-delivery project, so that you can see
the SHAPE without borrowing the words. Never copy one into your answer -
your objects come from the declarations you were given, not from here.

  Scan the parcel barcode at the depot
  Reject a parcel over the weight limit
  Record the courier handover
  Answer 200, or 409 on a duplicate label

THE OBJECT IS THE PART THAT GOES WRONG.

An object is empty when it names the mechanism instead of the thing. These
are not objects, and a line leaning on one is rejected:

  it, this, the data, the request, the response, the call, the send,
  the saving, the write, the read, the operation, the action, the logic,
  the process, the result, the value, the input, the output

  WRONG                       WHY                 FIX BY ASKING
  Process the send            sends what?         what is sent, and to whom
  Handle the saving           saves what?         what is written, and where
  Wait for write              writes what?        which record is waited on
  Return status code          which, and when?    the number, and the case
  Wait for incoming request   which request?      the route that is answered
  Handle response             whose response?     what is read out of it

These exact phrases are banned outright, in titles and in readings alike:
  Process the send, Handle the saving, Wait for write, Return status code,
  Wait for incoming request, Handle this, Process request, Do the operation,
  Perform action, Manage data, Handle response, Execute function, Run logic,
  Process data, Handle data, Handle request, Process response

FORBIDDEN OPENINGS - NO LINE MAY BEGIN WITH THESE WORDS

  Handle, Process, Manage, Execute, Perform, Run, Do, Support, Implement,
  Ensure, Deal with, Take care of

They are not verbs for what the system does - they are placeholders for a
verb you have not chosen yet. Each has a real verb behind it. Find it by
asking what actually happens to the object:

  Handle the delivery response  -> what is read out of it?
  Process the dispatch          -> what is sent, and where to?
  Manage the courier session    -> opened? read? closed?
  Execute the transaction       -> what does it write?

The same applies mid-line: "Server returns status codes" names no code and
no condition. The facts list the numbers - use them.

THE LINE MUST STAND WITHOUT THE FUNCTION NAME.

The code identity is printed underneath as evidence, not as the
explanation. Cover it and read the line alone. If a developer who has never
opened the file cannot say what the system does, the line failed - it was
narrating the identifier.

  identity: dispatchParcel:function
    "Process the send"     -> fails: only means anything beside the name
    "Dispatch parcel"      -> weak: the identifier with a space in it
    "Hand the parcel to the courier"  -> passes

EVERY CONTENT WORD MUST TRACE TO EVIDENCE.

You are given static facts. Each licenses particular words; words no fact
supports are invented, so cut them.

  calls contains "res.status", with numbers
      -> the reply and the codes it answers with
  calls contains a service or module method, awaits >= 1
      -> it hands the work on, and waits for it
  calls contains a named check (compare, verify, validate)
      -> the check being made
  throws >= 1, or catches >= 1
      -> the failure path, and what gets refused
  returnsNullish >= 1
      -> it can answer with nothing
  params
      -> what it is handed
  entryCount / entries on a declaration of kind "data"
      -> what the list holds, and how much
  the declaration's own name and file path
      -> the domain nouns to write with

Name the route, the status code, the table, the column, the check whenever
a fact shows one. Where the facts show none, say what IS true rather than
what is not: a line beginning "No" or "Nothing" is true of half the steps in
any project and so distinguishes none of them.

Do NOT invent business behaviour. If the facts show a parcel being sent,
write "Hand the parcel to the courier", not "Notify the recipient and update
the analytics dashboard".

NO TWO LINES MAY BE INTERCHANGEABLE.

Read your lines for one feature as a list. If two could swap places without
a reader noticing, both are too vague - rewrite both. No line may appear
twice: a line you have already written is a stock phrase you reached for,
not an explanation of the step in front of you.

Several nodes often share ONE declaration. That is allowed only when the
facts show genuinely separate behaviours. List those behaviours first, then
write one line each:

  dispatchParcel, facts: awaits 1, catches 1, throws 2,
  calls ["courierService.book", "res.status"], numbers [200, 400, 409]

  RIGHT - three behaviours the facts show:
    Reject a parcel with no delivery address
    Book the parcel with the courier service
    Answer 200, or 409 on a duplicate label

  WRONG - one behaviour, worded three times:
    Process the send
    Handle the saving
    Wait for write

If the facts show one behaviour, write one node. Padding a feature with
restatements is worse than a short feature.

READ THE FEATURE BACK AS A FLOW.

Take the feature's lines in step order and read them as one paragraph. It
should read as what the software does, start to finish:

  Receive the parcel booking -> Reject a parcel over the weight limit ->
  Record the courier handover -> Answer 200, or 409 on a duplicate label

not:

  Handle request -> Process verification -> Handle saving -> Process response
`;
