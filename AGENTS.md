# Release safety

New game development belongs in test/ by default. Root index.html, game.js, and themes.css are production. Keep all test assets independent, with relative links inside test/. Preserve the static test banner and stable-game link. Only promote test files into root when the user explicitly asks to release them. Run both test.cjs and test-themes.cjs in each folder. Verify root game files remain unchanged for test-only work.
