# What to test on the tablet

Simple checklist, in the order things were built. Each line says what to
do and what you should see. If something doesn't match, that's a real bug
to report — write down which line it was.

## Math engine (new this session)

1. Open any page. Tap the new **"Math"** button in the header (next to
   the Background button).
   - **Expect**: a panel opens with a text box, a "Variable" box, and
     four buttons: Solve / Differentiate / Integrate / Simplify.
2. Wait a moment. You should see "Starting the math engine…" briefly.
   - **Expect**: this needs the internet the first time (it downloads the
     math engine, a few MB) — if you're offline, it'll show an error
     instead. That's expected for now; full offline math is still to come.
3. Type `x**2 - 5*x + 6 = 0` in the box, make sure "Solve" is selected
   (it's the default), tap **Solve**.
   - **Expect**: a few steps appear (discriminant, quadratic formula),
     then "Solutions" showing `3` and `2`, each with a green "verified"
     next to it.
4. Clear the box, type `x**3 * sin(x)`, tap **Differentiate** then the
   Differentiate button.
   - **Expect**: several steps (power rule, chain rule, product rule),
     ending in a final boxed result.
5. Type something slow/complicated on purpose (or just try a very long
   expression) and watch for a **Cancel** button appearing next to the
   action button while it's working.
   - **Expect**: tapping Cancel stops it immediately, and you can type
     something else and try again right after.
6. Type something clearly invalid, like `x +* 2`, and tap Solve.
   - **Expect**: a red error message, not a crash or a frozen panel.
7. Tap **Close** to dismiss the panel, then reopen it from the same page.
   - **Expect**: it should start up fast the second time (no "Starting
     the math engine…" wait) since it's already loaded for this session.
8. Type `sin(x)`, tap the **Plot** mode button, then tap **Plot**.
   - **Expect**: a wavy sine-curve graph appears below the buttons.
9. In Settings, scroll to "Math notation" and turn **Electrical mode**
   on. Go back to a page, open Math — you should now see an extra
   **Impedance** button.
   - **Expect**: tapping it shows R/L/C/frequency number boxes instead
     of the usual text box. Try R=100, L=0.01, C=0, f=60, tap Impedance.
     You should see a few steps and a final answer with "verified" in
     green.
10. In Settings, turn Electrical mode back off if you don't want it — the
    Impedance button should disappear from Math again.

## Writing feel (from earlier this session — re-check if you haven't yet)

8. Write a few normal words with your hand resting on the screen the way
   you normally hold it.
   - **Expect**: the page does NOT shift/pan right when you lift the pen
     after finishing a word.
9. Try the Pencil pen type on a real stroke.
   - **Expect**: visibly lighter and a bit rough/grainy compared to
     Fountain pen, not just thinner.

## If anything above fails

Write down: which numbered step, what you expected vs. what happened, and
whether you were online or offline. That's enough for the next session to
find it without you needing to explain more.
