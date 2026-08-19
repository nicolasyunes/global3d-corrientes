# Delta for quality-tooling

Repo-wide quality gates: vitest, flat-config ESLint, Prettier, and TypeScript typechecking, all runnable via package scripts. Greenfield — all requirements are ADDED.

## ADDED Requirements

### Requirement: Test Runner

The system MUST provide Vitest as the test runner with an npm script that executes the test suite and exits non-zero on failure. Test files SHALL be colocated or organized under a discoverable pattern that Vitest picks up by default.

#### Scenario: Tests run and pass

- GIVEN the dependencies are installed
- WHEN the test script runs
- THEN all tests execute and the process exits zero when they pass

#### Scenario: Failing tests block the gate

- GIVEN a failing test exists
- WHEN the test script runs
- THEN the process exits non-zero

### Requirement: Linting

The system MUST provide ESLint using the flat config format, covering TypeScript and React source files, runnable via an npm script that exits non-zero on lint errors.

#### Scenario: Lint passes on clean code

- GIVEN source files with no lint violations
- WHEN the lint script runs
- THEN the process exits zero

#### Scenario: Lint fails on violations

- GIVEN a source file with a lint violation
- WHEN the lint script runs
- THEN the violation is reported and the process exits non-zero

### Requirement: Formatting

The system MUST provide Prettier with a repository-level configuration and npm scripts to check and apply formatting. ESLint and Prettier configurations MUST NOT conflict (formatting rules delegated to Prettier).

#### Scenario: Format check passes on formatted code

- GIVEN all files are Prettier-formatted
- WHEN the format-check script runs
- THEN the process exits zero

#### Scenario: Format check flags unformatted files

- GIVEN a file that deviates from Prettier formatting
- WHEN the format-check script runs
- THEN the file is reported and the process exits non-zero

### Requirement: Typecheck Gate

The system MUST provide an npm script that runs the TypeScript compiler in no-emit mode and exits non-zero on type errors. Strict typechecking SHALL be enabled.

#### Scenario: Typecheck passes

- GIVEN the codebase has no type errors
- WHEN the typecheck script runs
- THEN the process exits zero

#### Scenario: Typecheck fails on type errors

- GIVEN a source file with a type error
- WHEN the typecheck script runs
- THEN the error is reported and the process exits non-zero

### Requirement: Post-Completion Config Re-Evaluation

After this change lands, `openspec/config.yaml` MUST be updated: testing detection re-run and `strict_tdd` re-evaluated (placeholder is currently `false`).

#### Scenario: Config reflects installed tooling

- GIVEN the tooling of this change is installed
- WHEN the change completes
- THEN `openspec/config.yaml` lists vitest, tsc, eslint, and prettier
- AND the `strict_tdd` decision is recorded explicitly
