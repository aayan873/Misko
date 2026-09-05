# Competitive landscape

What already exists in this space, and which specific gaps in it Misko is built
around. Numbered because a few code comments reference specific items directly
(e.g. "see #5", "see #9") — the numbering is meant to stay stable.

1. **Khanmigo, Quizlet's Q-Chat, and plain ChatGPT-wrapper tutors** are the direct
   competitive set for an AI math tutor. All of them are fundamentally
   chat-first: a student converses with a model that responds in natural
   language. Correctness checking and hint quality both ride on the model's
   judgment call in the moment, which is fluent but not inspectable or testable
   the way a matched-distractor lookup is. (See #10 — this used to say none of
   them detect misconceptions at all; that specific claim didn't age well and
   has been corrected.)
2. **Streak-based mastery gates** (Khan Academy's exercise mode is the most
   visible example: get N in a row right and the skill is marked done) treat one
   wrong answer as equivalent to zero progress. This is the direct reason
   `src/lib/bkt.ts` uses Bayesian Knowledge Tracing instead — see
   RESEARCH/LEARNING_SCIENCE.md #3.
3. **Duolingo-style spaced repetition** is mature and validates that
   interaction-scheduled review works as a product mechanic, not just in the
   literature — but it schedules on wall-clock days, which doesn't fit a
   single-sitting hackathon demo. Misko keeps the mechanism and swaps the clock
   for an interaction count instead (RESEARCH/LEARNING_SCIENCE.md #7).
4. **The Correct Answer Trap research** (arXiv 2605.23925, 2606.23205) is the
   direct motivation for Misko's confirmation-round mechanic — see
   ARCHITECTURE.md "Catching the Correct Answer Trap" and
   RESEARCH/LEARNING_SCIENCE.md #6. As far as this research could find, no
   shipped consumer tutoring product runs anything like it; the papers
   characterize the blind spot, they don't describe a product closing it.
5. **"Seeing the Big Picture"** (arXiv 2510.05538, Henkel et al.) evaluates
   multimodal LLMs reading handwritten student work and finds them strong at
   transcribing handwritten arithmetic/algebra steps but weak at interpreting
   freeform diagrams. That's why `/api/transcribe-work`'s prompt
   (`src/lib/ai/prompts.ts`) asks only for a transcription of written steps and
   is explicitly instructed to say so rather than guess when something is
   illegible or diagram-like, instead of trying to interpret drawings.
6. **Freeform reasoning classification** (asking the model to read a student's
   own explanation and name the specific flawed method, not just grade the
   final answer) is common in research prototypes but rare in shipped consumer
   tools, which mostly stick to answer-matching because it's cheap and
   reliable. Misko's rule-first/AI-second/similarity-third pipeline
   (ARCHITECTURE.md) is an attempt to get the diagnostic value of freeform
   classification without making the whole product depend on it working.
7. **Classroom tools tend to be all-or-nothing**: either a full LMS/roster
   integration, or nothing aggregate at all for a teacher to look at. There's
   not much in between — a lightweight, no-setup diagnostic view a teacher
   could glance at without provisioning accounts for a whole class.
8. **Most competitor product effort visibly goes into the student-facing chat
   experience** — the interface a student interacts with directly. Teacher- or
   parent-facing views, when they exist at all, tend to be an afterthought
   layered on top rather than a first-class feature.
9. Combined, #7 and #8 point at a real, comparatively underserved angle:
   teacher-facing diagnostic tools, compared to student-facing chat tutors.
   Industry surveys on grading workload vary a lot by methodology, but land
   somewhere around 5-15+ hours a week for a typical teacher, and delayed
   feedback measurably loses pedagogical value the longer it takes to arrive.
   An earlier version of this project had a `/teacher` class-wide aggregation
   view attempting this angle, and pulled it back out: the brief is explicit
   that a product should target one clear user, not everyone
   (prompt.md §6 — "do not target 'everyone'"), and splitting Misko's pitch
   across two personas (student and teacher) diluted the one it was actually
   built around. The gap is real and worth naming as a research finding, but
   chasing it here would have cost more in focus than it gained in coverage.
10. **The field moved during this project**: Khan Academy's Khanmigo shipped its
    own misconception-path detection this year, and academic work on the same
    problem has kept coming (arXiv 2606.21502; arXiv 2406.19356, DiVERT). That's
    good news, not a threat — a competitor and a growing research literature
    both independently converging on "detecting *why* an answer is wrong
    matters" is evidence the problem is real, not evidence Misko has nothing
    left to say. What Misko still doesn't share with a shipped misconception
    detector: (a) it never acts on a single AI judgment — a correct answer with
    shaky-looking reasoning gets an independent, deterministically-graded
    second problem before anything is flagged (the confirmation-round
    mechanic, item #4); (b) the same engine, taxonomy shape, and AI layer
    generalize to a second subject (chemistry, see A0 in
    RESEARCH/IDEA_SELECTION.md) with no changes to the diagnosis/mastery/AI
    code, a real test of whether the architecture is genuinely subject-agnostic
    or just happened to fit algebra; (c) the diagnostic pipeline itself uses
    more than one LLM call dressed up differently — a deterministic rule-based
    match first, then an LLM classification, then a local TF-IDF fallback with
    no key at all, plus a genuinely separate ML technique (text embeddings + a
    2D similarity layout on `/dashboard`, not prompting) for visualizing how a
    learner's mistakes relate to each other.
