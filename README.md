# [Atbash Frontend](https://atbash.finance/)

Project made for Atbash Protocol team using :

-   Typescript
-   React 16
-   Jest
-   Ethers.js
-   Redux
-   Context
-   MUI V5

## Access :

https://drtex0.github.io/atbash-frontend/

## Config

Fill the required variables from env file

```bash
cp .env.template .env
```

## 🔧 Setting up Local Development

Required:

-   [Node v14](https://nodejs.org/download/release/latest-v14.x/)
-   [Yarn](https://classic.yarnpkg.com/en/docs/install/)
-   [Git](https://git-scm.com/downloads)

```bash
git clone https://github.com/Atbash-Protocol/v1-frontend
cd v1-frontend
yarn install
npm run start
```

The site is now running at `http://localhost:3000`
Open the source code and start editing!

**Pull Requests**:
Each PR into `main` will get its own custom URL that is visible on the PR page. QA & validate changes on that URL before merging into the deploy branch.

## 👏🏽 Contributing Guidelines

We keep an updated list of bugs/feature requests in [Github Issues](https://github.com/Atbash-Protocol/v1-frontend/issues).

Once you submit a PR, our CI will generate a temporary testing URL where you can validate your changes. Tag any of the gatekeepers on the review to merge them into master.

_**NOTE**_: For big changes associated with feature releases/milestones, they will be merged onto the `develop` branch for more thorough QA before a final merge to `main`

# Atbash

## local network w/ hardhat

```
atbash-main: npx hardhat run

presale: npx hardhat run .\scripts\deploy.ts --network localhost

atbash-main: npx hardhat run .\scripts\fuckit.js --network localhost
```
