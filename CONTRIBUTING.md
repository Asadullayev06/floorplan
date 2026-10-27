# Contributing to Floorplan

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

[Open an issue](https://github.com/haydenschmitty/floorplan/issues/new/choose) and include:
- what you asked Claude, and what happened;
- the output Claude showed, especially lines starting with `✗` or `!`;
- your project's languages and frameworks, and whether it's one repo or several;
- your OS and Node version.

**Please don't paste private code, secrets, or screenshots of a map of a private project.** A description of the shape of the problem is usually enough.

Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Suggesting a feature

Open an issue describing what you were trying to do and what got in the way. Plugin users are often not engineers, so ideas that make the map clearer for them are especially welcome.

## Pull requests

1. Read [Developing Floorplan](docs/development.md) for the layout and how to test a local copy.
2. Keep changes focused, and follow the guidelines there:
   - no dependencies;
   - plain language in anything the map shows;
   - never store or print secret values;
   - keep examples generic.
3. Try your change on at least one real project, and say which kind in the PR.
4. If you changed behaviour people will notice, add a line to `CHANGELOG.md` under an "Unreleased" heading at the top.
5. Run `claude plugin validate .` before opening the PR.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
