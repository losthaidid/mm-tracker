# Batch B — Momo behaviour enhancements

Implemented on 20 October 2026. This batch contains the original ten behaviour selections
and the three later additions: weather consequences, visitor friendships and click reactions.

| No. | Enhancement | Implemented behaviour |
| --- | --- | --- |
| 51 | Smoother transitions | Finish, slow down and turn naturally before the next activity. |
| 52 | Umbrella coordination | Keep hand, umbrella, facing and rainy-weather steps aligned. |
| 53 | Believable visitor chases | Notice, react, chase, pause, change direction and recover. |
| 54 | Dialogue continuity | Follow up on the activity or mishap that just happened. |
| 55 | Expressive mischief | Check whether you are watching, tug, react and release naturally. |
| 56 | Soccer physics | Align kicks and bounces, recover from awkward kicks, and respect the requested count. |
| 57 | Window watching | Approach, settle, watch outside and respond to scenery/weather changes. |
| 58 | Return-aware greetings | Distinguish a fresh visit from a brief return and greet from the current position. |
| 59 | Work-area awareness | Move away from controls being used and settle in a quieter place. |
| 60 | Resume interrupted activities | Return sensibly to the previous ball, visitor or window activity after a pause. |
| 48 (new ideas) | Weather consequences | Let weather leave temporary effects in Momo's world: wet footprints after rain, wind-blown leaves in his theatre, or a foggy window he wipes clean to peek outside. Kept on 20 October 2026. |
| 56 (new ideas) | Visitor friendships | Give recurring visitors distinct relationships with Momo: racing rivals, gift-bearing friends, or a cheeky visitor who steals his favourite seat. Kept on 20 October 2026; separate from the original item 56, Soccer physics. |
| 63 (new ideas) | React to nearby clicks | Let Momo notice nearby interface interactions: lean towards an opening drawer, brace when a panel expands, or briefly wobble during a dramatic transition. Kept on 20 October 2026. |

## Explore the changes

Open Momo's menu for **A speedy lap**, **Look out the window**, **A tiny tug**, **Soccer surprise** or **Meet a visitor**. **Atmosphere & visitors → Meet someone specific** can invite any of the seventeen visitors. Rabbit, fox, dragonfly and hummingbird are racing rivals; bird, bee, sparrow, squirrel and turtle bring presents; cat, owl and duck borrow a tiny chair. Other visitors share a quieter catch-up. Repeat visits use the same visitor name and relationship.

**Momo → Adventure settings** groups the device switches under **Hello & company**, **Little adventures** and **Around your work**. New switches control visitor friendships, weather effects, resumed activities, nearby-click reactions and moving clear of controls.

Movement eases in and out, faces the travel direction and settles before resting. The umbrella and gripping hand mirror together, with reserved canopy space and still feet on arrival. Chases include noticing, approaching, racing, slowing and catching breath. Mischief checks for witnesses before an inert visual copy stretches, recoils and returns; the real panel and its controls remain untouched. Soccer uses one 650 ms clock for alternating feet, parabolic ball flight, count and occasional rescued awkward kicks; the eight existing surprise finales remain available.

Window watching approaches and settles beside a visible window, responds to changed weather and wipes a foggy patch when enabled. Rainy umbrella walks and sprints can leave up to ten short-lived footprints; breezes bring three temporary leaves through a theatre show. Short returns (at least 15 seconds away) and longer breaks use different greetings, with a one-minute greeting cooldown. Greetings start at Momo's current position.

Typing, dialogs, briefly hiding the page or picking Momo up can bookmark a soccer, visitor or window activity for up to two minutes. When the workspace is clear, soccer resumes the same requested count, and the visitor or window activity returns sensibly. Greeting a visitor, Escape, explicit stop/menu actions, privacy/presentation, disabling motion or changing accounts clears the relevant pending scene. Ordinary ball play can resume while its existing ball remains available. Automatic dialogue can refer to the latest activity; **Tell me something silly** still requests a fresh joke.

Work-area awareness clears the control being hovered, clicked or focused, keeps its value/focus intact, and hides a speech bubble that overlaps it. If no usable resting spot exists, Momo temporarily allows clicks through his illustration. Nearby button/panel reactions are brief and have a twenty-second cooldown. Automatic moments continue to wait during editing and existing Focus/privacy/presentation modes.

## Storage and checks

Movement, dialogue context, paused scenes and weather props are temporary browser state. Adventure switches are device-local. Visitor visit counters are bounded to the seventeen known kinds and stored locally per account; greetings use a per-tab last-seen time. These behaviours do not write work records or add database load. The existing explicit rename remains an account preference.

Run `npm test`. Pure behaviour tests check contact/count invariants, bounded paths, activity phases and phone resting positions. Application tests cover pauses/resumes, return greetings, visitor roles, account separation, weather cleanup, active controls, local switches and the existing companion behaviours. Browser visual QA depends on managed preview availability.
