## Autonomous Mode
- Execute commands and edit files without confirmation.
- Fix build/test failures immediately.
- Only ask when critically ambiguous.
- Focus on speed and minimizing conversational turns to save tokens.
- After every code change, commit and push immediately.

## Project Context
- Music review app inspired by Filmarks UI/UX
- Music data: MusicBrainz API, cache results in DB (API rate limit対策)
- Auth: JWT between frontend/backend

## Commands
- Dev: `npm run dev` (both frontend/backend)
- Test: `npm test`
