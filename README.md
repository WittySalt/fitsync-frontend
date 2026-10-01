# FitsyncFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.0.3.

## Development server

To start a local development server, run:

```bash
npm run start
```

Once the server is running, open your browser and navigate to `http://localhost:3000/`. The default npm start script uses port 3000 because the current Cognito app client is configured with `http://localhost:3000/auth/callback` and `http://localhost:3000/logout/callback`.

The current auth UI is implemented in Angular and calls Cognito User Pool APIs directly for sign-in, sign-up, email confirmation, and confirmation-code resend. The Cognito app client must enable `USER_PASSWORD_AUTH` for this custom login flow.

If you need Angular's default dev port for a non-Cognito check, run:

```bash
npm run start:4200
```

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## CI/CD

CI/CD runs on GitHub Actions only:

- `.github/workflows/ci.yml` runs on pull requests and on pushes to `main`/`develop`. It does the typecheck, unit tests with coverage, the production build and a gitleaks secret scan.
- `.github/workflows/cd.yml` provisions the frontend infrastructure (`infra/terraform/`) and deploys the SPA to S3 + CloudFront. Deploys are started by hand and stay off until the repository variables are set.

See [`.github/CICD-VARIABLES.md`](.github/CICD-VARIABLES.md) for the variables, and [`infra/terraform/RUNBOOK.md`](infra/terraform/RUNBOOK.md) for the infrastructure.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
