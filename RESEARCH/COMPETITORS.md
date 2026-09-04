# Competitive landscape

What already exists in this space, and which specific gaps in it Misko is built
around. Numbered because a few code comments reference specific items directly
(e.g. "see #5", "see #9") — the numbering is meant to stay stable.

1. **Khanmigo, Quizlet's Q-Chat, and plain ChatGPT-wrapper tutors** are the direct
   competitive set for an AI math tutor. All of them are fundamentally
   chat-first: a student converses with a model that responds in natural
   language. None of them ship a fixed, inspectable taxonomy of wrong-reasoning
   patterns tied to distractor answers — correctness checking and hint quality
   both ride on the model's judgment call in the moment, which is fluent but not
   inspectable or testable the way a matched-distractor lookup is.
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
   `/teacher` (`src/lib/learnerModel.ts`'s class-wide aggregation) is Misko's
   attempt at this angle — ranking common mistakes across every learner an
   instance has seen, and flagging who needs a look and why. It's an honest
   hackathon-scale demonstration of the idea (see the README's Limitations
   section for what it isn't), not a claim that this closes the gap outright.
