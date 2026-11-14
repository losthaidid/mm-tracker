/** Original lines for My Day. Each group pairs twenty openings with three related endings. */
(function (root) {
  'use strict';

  function collection(sections) {
    return sections.flatMap(([openings, endings]) =>
      openings
        .trim()
        .split('\n')
        .flatMap(first =>
          endings
            .trim()
            .split('\n')
            .map(second => ({ opening: first, text: first + ' ' + second }))
        )
    );
  }

  const morning = [
    [
      `
Pick the first thing you can finish.
Open the work you want to move forward.
Start at the point you understand.
You can begin with a rough version.
Write the question before you look for answers.
Clear enough space to do one useful thing.
If the plan feels big, find a small entry point.
Choose a start that fits the energy you have.
The first draft only has to give you something to shape.
Begin with the decision that makes the next one easier.
Give yourself permission to start slowly.
A blank page can hold the smallest idea.
Set up the work so you can return to it easily.
You can start before the steps feel obvious.
Make the part you’re avoiding smaller.
Use the first few minutes to get your bearings.
Put the most important file where you can find it.
Turn the task into one action you can picture.
Open the hardest thing and read it once.
Let the first step be the simplest honest one.
`,
      `
The next step will be easier to see.
Give it ten minutes and see what changes.
A small beginning still moves the work forward.
`,
    ],
    [
      `
Notice what you’re looking forward to today.
Start with something that feels worth caring about.
Think of the person who will use what you make.
Choose the conversation that would clear the air.
Keep one promise you made to yourself.
Let curiosity pick your first question.
Give the patient work a place on your calendar.
Your attention is yours to direct this morning.
Put one thing you value near the top of the day.
If everything feels urgent, look for what will still matter tomorrow.
Find a moment today to help someone else begin.
Choose one task that will make someone’s day easier.
Tell someone what would make the work easier to share.
Name what a good day would actually look like.
Think of something you want to understand by lunchtime.
Give a neglected idea fifteen minutes of real attention.
Leave room to notice something you didn’t expect.
The day can include something just for you.
Make time for a detail that will help the next person.
A little care at the beginning travels a long way.
`,
      `
Set aside a few minutes for it now.
That’s a good reason to begin.
Let that guide one choice this morning.
`,
    ],
    [
      `
A slow morning can still turn into a good day.
Yesterday’s missed task can become today’s smaller task.
You’re allowed to make a new plan with today’s energy.
Give yourself the patience you’d give a friend.
A fresh start can look like reopening the same document.
Your pace can change with what the day asks of you.
You can begin again after a long pause.
A hard morning deserves a plan with room in it.
There’s no need to make up for every minute you lost.
You can ask for help before you get stuck.
You have time to replace one unrealistic expectation.
Some days begin better after breakfast.
Choose a pace you’ll still have at lunch.
A good plan can make room for a difficult feeling.
You’re allowed to begin without knowing how you’ll feel at the end.
Make it easier to try again if the first attempt fails.
A smaller list can be an act of good judgment.
The energy you have is enough to take one step.
Even if the morning surprised you, you can choose what follows.
Give your own needs a place in the plan.
`,
      `
Give yourself room to adjust along the way.
One kind choice now can help the rest of the day.
Recheck the plan once you’ve found your feet.
`,
    ],
    [
      `
Make one improvement you’ll be able to see by lunch.
Write the kind of note that would have helped you yesterday.
Start with a question someone can answer clearly.
Identify the one thing you could learn from a first attempt.
Set a small goal you’ll know when you’ve reached.
Use today’s work to try one better habit.
Pause before choosing what deserves your first hour.
Describe the problem in your own words.
Break a broad promise into a useful next action.
Find a way to make the routine work a little more pleasant.
If a decision is hanging over you, give it time on the calendar.
Keep a record of what you try so you can learn from it.
Leave yourself a reliable place to put new ideas.
When a task feels familiar, look for the detail you usually skip.
Choose the part of the work you can improve with practice.
Make a note of the question you keep putting off.
Put one specific outcome beside your biggest task.
Decide what you can do today that will be easy to build on.
Take a moment to see how far the work has already come.
Give your best attention to something that can make a difference.
`,
      `
Use what you notice to make the next choice.
It’s worth finding out what a little attention can do.
Keep a short note of what changes.
`,
    ],
    [
      `
My morning plan and my calendar are in talks.
The coffee is still reviewing the list.
My first heroic act was finding the right charger.
I opened my inbox and it opened a second inbox.
The alarm clock had one job and performed it with unnecessary enthusiasm.
My browser restored 23 tabs and called it a fresh start.
The spreadsheet already has strong opinions about the format.
I gave my file a proper name and briefly felt like a wizard.
My task list woke up before I did.
I’m on my second attempt at making my first cup of tea.
The meeting invite arrived before the explanation.
The printer has requested a written apology before 9 a.m.
I have a fresh notebook and a suspicious number of sticky notes.
The breakfast toast was more decisive than I was.
I checked the weather and somehow opened four menus.
My plan had three steps until I named the first one.
I wrote myself a note that says “check the note.”
The calendar says available. My tea disagrees.
I counted opening the window as an early win.
My mouse has already scrolled farther than I’ve walked.
`,
      `
One useful task can still save the morning.
I’m putting one small win on the agenda.
There’s still time to make a respectable start.
`,
    ],
  ];

  const day = [
    [
      `
Give the next hour a clear job.
Choose what deserves your attention right now.
Pick one task to carry across the finish line.
Make the next piece small enough to finish.
Save a draft before you switch to something else.
A short, focused stretch is still real progress.
Close an open question instead of opening a new one.
Finish the piece another person is waiting for.
Stay with the smallest useful version of the task.
Give the tricky part your attention while it’s still fresh.
Keep what works and improve one detail.
Put one decision into words and share it.
Make a short list of what’s actually left.
Use the next half hour on something you can verify.
Name the result you want before making another change.
Return to the task you know how to move forward.
Take the one action that reduces tomorrow’s work.
Spend a little time making the main point clearer.
Leave the work a little more complete than you found it.
Choose one detail that will matter to the person using this.
`,
      `
Check the result before you move on.
You’ll have something concrete to show for the time.
Let that be enough for this stretch.
`,
    ],
    [
      `
If the morning ran over, there’s still an afternoon.
The plan can change when you learn something new.
You can choose a different route at any point.
Take a breath and look at what has actually changed.
One setback gets one decision, not the whole day.
Cut one promise from the list if it would free up useful time.
Give the task that stalled a cleaner starting point.
Try a smaller version of the thing that didn’t work.
A late start can still be a good start.
You can change the order when the day changes its mind.
Make a new estimate with the information you have now.
Pick up where it makes sense today.
One interrupted hour doesn’t decide the next one.
Reopen the task once you know what you need from it.
Some things can move to tomorrow with a short explanation.
You can replace a vague goal with a clear next step.
If you have less time than you planned, spend it carefully.
Let the work teach you how to restart it.
Check whether the obstacle is effort, time, or one missing answer.
You’ve learned something about the plan. Use it.
`,
      `
There’s still room for one good decision.
A fresh choice can change the rest of the afternoon.
Start again with what you can affect.
`,
    ],
    [
      `
A proper break can give you back your attention.
Stand up and let your eyes rest for a minute.
Have some water before you read the same line again.
Give yourself a few minutes away from the screen.
If you’re rereading the same sentence, go get some air.
Save your place before you head to lunch.
Put a real pause between two demanding tasks.
A walk around the room can be enough of a reset.
Let a quiet minute sit between the meetings.
Protect enough energy for the last thing you need to do.
Step away if every option is starting to look the same.
Leave the chair for a bit when the work feels heavy.
Get back to the question after you’ve had a snack.
An unhurried moment can make the next decision clearer.
Finish your drink before the next conversation.
Check how you’re feeling before adding more to the list.
Give your hands and shoulders a chance to loosen up.
A quiet break is something you can take before you’re exhausted.
Look out a window for long enough to notice something.
A pause can be part of how you get a difficult thing done.
`,
      `
You can return when you’re ready to concentrate.
The work will be there in a few minutes.
Leave a short note about where to pick it up.
`,
    ],
    [
      `
Ask someone what they actually need from the next version.
Use one helpful comment to improve the work.
Notice which of your decisions made the job simpler.
Be specific when you ask for another pair of eyes.
Solve the problem you can demonstrate.
Wrap one piece of context up for the person taking over.
Show someone the smallest example that explains the issue.
Write down the assumption that’s doing most of the work.
Use what you’ve learned to make a clearer recommendation.
Say what changed in a way someone can act on.
Check a little detail before it becomes a larger one.
Try the route that will give you an answer sooner.
Take the time to understand the problem you’re solving.
Thank someone for the part of the work they made easier.
Move a useful piece of information out of your head and into a note.
A good question can save two people an hour.
Find the sentence that explains the result without the backstory.
Let a colleague see the work while their feedback can still help.
Share the decision and the reason you made it.
Take the time to make one outcome easier to verify.
`,
      `
A little clarity is a useful result on its own.
Make it easy for the next person to take a step.
You can build the next decision on that.
`,
    ],
    [
      `
I booked time for focus and the meetings appeared to investigate.
My “quick reply” is currently in its third paragraph.
The to-do list has drafted a sequel.
Lunch ended and the spreadsheet still hasn’t learned manners.
My afternoon reminder wanted a reminder of its own.
The inbox has achieved a result I can only describe as ambitious.
I moved a task to later and it immediately opened a support ticket.
One more tab and the browser can register as a library.
My water bottle is still full, which explains several recent decisions.
A quick question has requested five supporting documents.
I upgraded my plan from “do it” to “find the file.”
The vending machine made a more compelling case than the meeting.
All I asked the sheet for was one number.
I got distracted organising my distractions.
The chat says “one sec,” which is a unit of variable length.
I took a desk snack to a very productive one-on-one.
That “final” folder has enough versions to start a museum.
My cursor has been blinking patiently through this entire debate.
I spent longer choosing the status than changing it.
The meeting finished early. I am choosing to believe in miracles.
`,
      `
There’s still time to finish one good thing.
I’m giving the next ten minutes to something with an ending.
One checkbox and a glass of water would improve the situation.
`,
    ],
  ];

  const dusk = [
    [
      `
Write down the first thing you’ll do tomorrow.
Leave a note at the exact point where you stopped.
Put the unfinished work somewhere you can find it.
Close the loop on one question while you remember the answer.
Give tomorrow one easy place to start.
Send the update someone needs before you log off.
Sort the loose notes into a place you’ll check again.
Move the unfinished tasks to a day when they can get attention.
Save your work with a name that makes sense in the morning.
Put the next action near the decision that created it.
If you owe someone a reply, leave a clear next step.
Close down the part of the work that’s actually done.
Capture the one detail you’d hate to have to rediscover.
Write the question you’ll ask when the right person is back.
Leave enough context that you can return without guessing.
Move tomorrow’s priority somewhere it won’t get buried.
Make a short handover for yourself.
Put the useful links next to the task they belong to.
Check which promise still needs an owner.
Leave yourself a clear stopping point.
`,
      `
A thoughtful ending makes a gentler beginning.
Once it’s recorded, you can step away.
A few clear words can save tomorrow’s time.
`,
    ],
    [
      `
Notice one thing you handled better than you used to.
Give yourself credit for making a difficult choice.
Remember the point where the work became clearer.
Think of one person who made the day easier.
Look at something that exists because you started it.
Name a small win that no one else would notice.
Remember an idea that got better after you listened.
Count the problems you stopped from getting bigger.
Think about a moment when you chose patience.
Give the careful, ordinary work its share of credit.
Notice the question you were brave enough to ask.
Take a moment to remember what you learned by trying.
Think of one thing your future self will thank you for.
A task that made sense by evening counts as progress.
Name the decision you made with better information than yesterday.
Notice which part of a long project you brought closer.
Remember the person you made time for.
Give the work you did quietly a place in your account of the day.
Notice one thing you were able to make simpler.
Count the moment you began again when it would have been easier to stop.
`,
      `
That belongs in your memory of today.
Keep the useful part with you.
It’s worth taking a minute to recognise it.
`,
    ],
    [
      `
Make an honest plan for the things you’re leaving.
You can stop at a point you can return to.
Take an evening that belongs to something other than work.
Leave a hard question to a rested mind.
Give the rest of the evening some room.
You can take the day as it came and still close it well.
One unfinished thing can wait on a written next step.
Make a clear decision about what can wait.
Turning off the screen is an action you can choose.
A complete list is rarely the point of a day.
Keep something pleasant in the last part of the day.
Set down a task once it’s safely recorded.
You can leave a few things open with a good explanation.
End the day before you lose the energy you wanted for yourself.
If you’ve been hurrying, do one thing slowly.
Give yourself a stopping time you can actually keep.
You can plan for next time without reopening the whole job.
Take the fact that you’re tired into account.
Spend a little of this evening away from the things to finish.
The day has earned a proper ending.
`,
      `
Leave the remaining work somewhere it can wait.
You’ll be able to return with more attention.
A little space now can make tomorrow better.
`,
    ],
    [
      `
Think about the habit that made today easier to start.
Pick one thing you’d do differently next time.
Notice the kind of work that made you lose track of time.
Remember which question led to the answer you needed.
Think of the point where a break helped.
Check whether the work matched what you wanted from the day.
Keep a record of the fix that finally worked.
Look for the reason one task took less time than expected.
Ask yourself which interruption was worth your attention.
Look back at the choice that made the rest simpler.
Choose one piece of advice you would give yourself at breakfast.
Find something useful in the part that didn’t work.
Note the step you would explain differently to a colleague.
Pay attention to when you had the most energy.
Decide which task was more important than it first looked.
Think of a shortcut worth keeping because it made sense.
Notice where asking earlier would have helped.
Look back at a plan you changed for a good reason.
Think of the one step you’d want to repeat.
Find out what you can learn from the order in which you worked.
`,
      `
Write down the part you want to remember.
Use it to make one better choice tomorrow.
A small lesson is worth keeping.
`,
    ],
    [
      `
My task list has agreed to take this offline.
The calendar has stopped making suggestions. I respect its growth.
The document chose closing time to reveal its last typo.
My laptop asked whether I wanted to save. That felt personal.
The leftovers are making a convincing case for logging off.
I made a folder called “tomorrow” and it’s already overqualified.
The inbox is still open, but so is the fridge.
My evening walk has been waiting in the lobby all day.
I finished the task and immediately remembered a shorter way to do it.
My mug has been promoted to desk decoration.
I’ll let the charger deal with the laptop’s evening routine.
Today’s plan is eligible for a very short documentary.
I’m ending the session before the keyboard asks for overtime.
My pen has gone missing with most of the afternoon.
The most reliable calendar notification today was hunger.
The mouse double-clicked and I’m calling that its goodbye.
Apparently “one last edit” has several siblings.
The file is called “final enough,” a carefully negotiated settlement.
I found the button for Do Not Disturb. It’s harder to find the nerve.
The evening light is filing a request for a shorter workday.
`,
      `
I’ll leave a note for tomorrow and call it a day.
That’s a good excuse to go and get some dinner.
My next task is to close the laptop with feeling.
`,
    ],
  ];

  const night = [
    [
      `
If the idea is good, give it a place to wait.
Write the thought down before trying to solve it.
Leave yourself one sentence to find in the morning.
You can end a difficult day without explaining all of it.
Set tomorrow’s first step down in a note.
Let a promising idea sit on its own for a while.
One clear question can wait for a fresh mind.
Make a bookmark at the part you’ll want to read again.
The unfinished thing can live in your notes for a night.
A thought can be worth keeping without becoming tonight’s task.
Give a loose end a name and somewhere to be.
Write down what matters so you don’t have to keep thinking about it.
Put the thing that keeps coming back on a short list.
Keep the useful part of the idea and let the rest settle.
Take the point you don’t want to lose and put it in a sentence.
Leave a note for the version of you that has had breakfast.
You can save an idea in the middle.
Write a small opening for whatever you’ll continue tomorrow.
Let the last task be making the next one clear.
A decision can wait if the next action is already written down.
`,
      `
You’ll have a place to begin when you come back.
Once it’s written, give your mind a little space.
It can wait for the morning.
`,
    ],
    [
      `
You can be proud of what you did with the energy you had.
A quiet day can still contain useful work.
Think of the moment you gave something your full attention.
Remember one kindness you gave or received today.
A hard day can have a gentle ending.
An unfinished week still contains things you did well.
Notice the effort behind an ordinary result.
Think of a moment you chose to be patient with yourself.
Some progress takes a while to recognise.
Remember one thing you understood better by the end.
Give the day credit for the good it did contain.
Choose a small success you can remember without opening the laptop.
Remember a time today when you said what needed saying.
The work you did to begin again has value.
A change you barely noticed can matter in a month.
Think of the bit of care you put into something for another person.
You can be glad about a result that still needs work.
Remember which things made the day feel worthwhile.
Notice how a problem looked different once you’d worked on it.
Give your steady effort a little credit before you close the day.
`,
      `
Take a moment to let it count.
It’s a good thing to leave the day with.
Some things are easier to recognise in the quiet.
`,
    ],
    [
      `
Rest gives your attention somewhere to come back from.
Leave the day where it ended.
You can take the pressure off yourself for the night.
Take a minute to let your shoulders drop.
It’s reasonable to give a tired mind fewer demands.
Turn the light down on what’s left of the list.
Choose the thing that helps you wind down.
Let the room be quiet for a while.
Give yourself a break you don’t have to explain.
It’s fine to leave a late message for the morning.
The bed can be more useful than another hour at the desk.
Closing the laptop can be the next good decision.
Give yourself a few minutes to come off the clock.
You can enjoy the quiet without filling it.
Let tonight be long enough to rest.
Ease into a different pace when the work is over.
It’s all right to be finished for today.
Put the next demand far enough away to catch your breath.
Leave the lights a little softer than they were an hour ago.
Take a few unhurried minutes before the day ends.
`,
      `
Give yourself permission to leave it there.
Tomorrow will have its own time.
There is room to be off duty now.
`,
    ],
    [
      `
When you return, begin with what you already know.
Think of one thing you’d like to give tomorrow’s attention to.
Let the question get smaller while you sleep.
Keep the hope and let go of tonight’s deadline.
Imagine handing the plan to a friend who has just woken up.
Leave the decision until you can consider it fairly.
You can set out a calmer morning before bed.
Picture the first half hour you’d like to have tomorrow.
Give yourself something pleasant to begin with.
Choose a first step that will age well overnight.
Bring your expectations down to the size of a real morning.
Make the plan gentle enough that you’ll want to return to it.
There are ideas you’ll understand better after a pause.
Set aside a little room for a good surprise tomorrow.
Remember that you’ve found your way through unfamiliar work before.
Look forward to the part you’ll be able to choose.
Put the worry next to one action you can take tomorrow.
Keep a little faith in what time and attention can change.
Consider what a fresh pair of eyes might notice.
You’re allowed to make a new plan after you’ve slept.
`,
      `
Make room for the person you’ll be in the morning.
There’s value in returning with a little more energy.
Start with a rested version of the same effort.
`,
    ],
    [
      `
My best idea arrived at midnight carrying no practical information.
I opened a notebook and the notebook opened a negotiation.
The “quick check” is trying to turn into breakfast.
I saw a full moon and briefly considered asking it to proofread.
My slippers would like to revise the rest of my schedule.
The task list can send another email if it feels that strongly.
My brain has proposed a new project with a launch date of right now.
I looked for the end of the internet and found another settings menu.
The last tab says “tomorrow,” and for once I agree.
My keyboard has stayed up past its bedtime.
I tried turning the day off and on again. It says to wait eight hours.
The fridge light has presented the evening’s shortest meeting.
I’ve remembered the perfect reply to a conversation from 2013.
My eyes have given the screen a fairly clear performance review.
The notes app now contains the phrase “idea about the thing.”
I have located a missing thought five minutes before bed.
Typing “good night” to the computer felt oddly appropriate.
The next available slot in my calendar is labelled “pillow.”
I can still hear the little sound my tea made when it became a bad idea.
The stars have done a surprising amount of work without sending updates.
`,
      `
It can wait in Notes until breakfast.
I’m recording it and letting the night be quiet.
Tomorrow is welcome to follow up.
`,
    ],
  ];

  root.WorkHubMyDayQuotes = Object.fromEntries(
    Object.entries({ morning, day, dusk, night }).map(([period, sections]) => [
      period,
      collection(sections),
    ])
  );
})(typeof window === 'undefined' ? globalThis : window);
