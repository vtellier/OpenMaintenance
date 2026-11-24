# Research brief: native apps per platform, kept in sync by AI, tested by one shared suite

You are running a deep research study for the maintainer of OpenMaintenance. The maintainer is leaning towards an architecture for shipping the app on web, Android and iOS, and wants evidence before deciding. Your job is to gather that evidence, both for and against, from practitioners and from research, and deliver a cited report. The maintainer has not decided yet: the report informs a decision; it does not confirm one.

Today's date is in your environment; date every source, because evidence about AI-assisted development goes stale within months.

## Context

**The project.** OpenMaintenance is a free, open-source, self-hostable web app for tracking maintenance tasks on equipment (boats, cars, homes). One Go binary (Echo + SQLite) serves a REST API and the web frontend embedded in the binary. An OpenAPI spec is the contract between them, and the TypeScript client is generated from it. There is no authentication: security is delegated to the deployment.

**The frontend today.** Arrow.js + Vite, about 4,500 lines of TypeScript, of which about 730 are framework-free rules (calendar dates, urgency ranking, form rules, equipment groups). Tests: Go unit and `httptest` tests, Vitest for the rules, 37 Playwright regression specs. Many past bugs were date and timezone bugs (off-by-one dates, dates shifting east of UTC, local "today").

**The maintainer.** A solo open-source maintainer who works spec-first and test-first with AI coding agents. Has a Linux PC, a Mac, an iPhone and an Android phone.

**The goal.** Make the app *deployable* on web, Android and iOS. Authentication and a "server URL" setting for the mobile apps are known follow-up work.

**Already rejected**, so treat them as evidence only (why a team adopted or left them), never as the recommendation:
- Capacitor and other webview wrappers.
- Expo / React Native: forced SDK upgrade cadence, and a paid build cloud that cannot be self-hosted.
- Flutter, Compose Multiplatform and other cross-platform UI layers. The maintainer's thesis: the future is native stacks without cross-platform middleware.

## The hypothesis under study

Score every element separately; the report refers to them by label.

- **H1 Native UI per platform.** A web framework of choice, Kotlin + Jetpack Compose on Android, Swift + SwiftUI on iOS. Expected to beat cross-platform UI layers on stability, openness and per-platform quality over a 5+ year horizon.
- **H2 AI keeps parity affordable.** AI coding agents make maintaining three codebases in step affordable for a solo maintainer.
- **H3 Thin clients.** Business rules live in the Go API; the apps render and collect input. Only device-bound rules (local "today", formatting, form rules) stay in the apps.
- **H4 Single-source artefacts.** Written once, generated for each platform: API clients from OpenAPI, element identifiers (`ids.yaml`), localized strings, and JSON test cases for the device-bound rules, run by Vitest, Swift Testing and JUnit.
- **H5 One shared end-to-end suite.** Intent-level flows written once, per-platform screen objects where the UIs differ, identifiers as the contract, run in a browser, the Android emulator and the iOS simulator. WebdriverIO + Appium is favoured; Maestro, Robot Framework, CodeceptJS and Midscene.js are the alternatives.
- **H6 Parity gate.** A feature ships when its shared flow is green on all three platforms.

## Research questions

Each question lists starting **leads**: recalled from memory, so verify each one, and treat them as entry points rather than the boundary of the search.

**Q1 Precedent.** Who builds one product natively on web, Android and iOS while deliberately sharing contracts (API schemas, identifiers, strings, design tokens, test cases) rather than UI code? How did they keep parity, what did it cost, what broke? Weight small teams and solo maintainers as heavily as big tech.
Leads: Bitwarden's move from Xamarin to native Swift/Kotlin apps with a shared Rust SDK; Signal (native apps around libsignal).

**Q2 Migrations in both directions.** Teams that moved native → cross-platform or back, and their stated reasons, as cost data for H1 and H2.
Leads: Airbnb "Sunsetting React Native" (2018); Udacity's React Native retrospective (2018); Dropbox "The (not so) hidden cost of sharing code between iOS and Android" (2019); Shopify "React Native is the future of mobile at Shopify" (2020) as a counterpoint.

**Q3 AI-maintained parallel codebases.** Evidence from 2023 onwards on AI agents implementing or porting one feature across several languages and platforms: accuracy, the kinds of bugs introduced, review load. Above all, **correlated failure**: when three implementations come from the same spec and the same model, do their bugs coincide, so that shared tests are the only independent check? Separate measured results from anecdotes.
Leads: Avizienis on N-version programming (1985); Knight & Leveson, "An experimental evaluation of the assumption of independence in multiversion programming" (1986); Pan et al., "Lost in Translation: A Study of Bugs Introduced by Large Language Models while Translating Code" (ICSE 2024); spec-driven development tools such as GitHub Spec Kit and AWS Kiro (2025).

**Q4 Where the rules live.** Rules in the server (H3), compared with a shared logic core under native UIs, and with duplicated rules guarded by shared test cases (H4). Cover the effect on offline use and on self-hosted deployments.
Leads: server-driven UI (Airbnb's Ghost Platform, 2021); Kotlin Multiplatform for logic only (Netflix, Cash App); Rust core with UniFFI (Mozilla application-services); Crux (Red Badger); Hotwire Native (37signals; webview-based, relevant only as a "server owns the logic" data point for small teams).

**Q5 One test definition, many implementations.** Precedents for one test suite judging several independent implementations of one spec, plus research and practitioner reports on reusing GUI tests across platforms. For each tool in H5, collect experience reports covering web + Android + iOS together: flakiness, run time, maintenance cost, how native widgets (date pickers, photo and file pickers, permission dialogs) were handled, and how identifier contracts were kept.
Leads: web-platform-tests (one suite for every browser engine); Test262 (JavaScript engines); AppFlow (FSE 2018); CraftDroid, "Test Transfer Across Mobile Apps Through Semantic Mapping" (ASE 2019); search terms "GUI test migration" and "cross-platform GUI test reuse".

**Q6 Stability and openness of the native stacks.** API churn history of SwiftUI and Jetpack Compose, compared with web frameworks; the upgrade cadence that app stores impose whatever the framework (minimum Xcode versions, Android target API levels); licenses; toolchain requirements (macOS for iOS); building for F-Droid.

**Q7 Self-hosted open-source apps on three platforms.** How self-hosted FOSS projects ship mobile clients: stacks chosen, how they handle server URL, authentication and TLS, contributor accessibility across three languages, and maintenance load reported by maintainers.
Leads: Home Assistant (native companion apps), Immich (chose Flutter: a counterpoint), Nextcloud, Jellyfin.

**Q8 Conditions and warning signs.** From everything above: under which conditions does the hypothesis win or lose, what early warning signs show it failing, and what is the smallest real (not throwaway) first step that would test it?

## Method

If you can delegate to subagents, give each research question to one and keep steps 4 to 6 for yourself.

1. **Plan.** Write a search plan: for each question, queries across three source types: engineering blogs and talks, papers (peer-reviewed or arXiv), official docs and changelogs. Done when every question from Q1 to Q8 has queries in at least two source types.
2. **Sweep.** Run the plan broadly and log every candidate (title, author or org, date, URL, type). Follow each strong source's references and the works that cite it. Done when each question has at least five candidate sources, or a log of the searches that came up empty.
3. **Read.** Open and read the sources you intend to use, beyond the search snippet. For each claim, record who, when, team size, app type, whether it was measured or anecdotal, and the outcome. Done when every claim you will use comes from a source you opened.
4. **Steelman the counter-case.** For each of H1 to H6, search specifically for the strongest evidence against it. Done when each H has its strongest counter-case written down with a source, or the list of searches that found none.
5. **Synthesize** the deliverable below.
6. **Verify.** Every factual sentence cites a source you opened; every source carries a date; vendor sources (a tool maker writing about its own tool or its competitors) are flagged; every finding has a confidence level. Done when this holds for the whole report.

**Source rules.** Prefer primary sources: the team that did the work, the paper's authors, the official docs. When only an abstract is reachable, say so. Flag every vendor source. When the evidence is thin, say so plainly; a well-documented gap is a useful finding.

## Deliverable

One Markdown report. If you have access to the OpenMaintenance repository, save it as `doc/research/native-multiplatform-study.md`; otherwise return it as a single Markdown document.

1. **Executive summary** (one page at most): a verdict on the hypothesis for this project with a confidence level, the five biggest risks, the five most useful recommendations.
2. **Hypothesis scorecard:** H1 to H6, each marked supported, mixed, contradicted or unknown, with its key sources.
3. **Findings** for Q1 to Q8: the answer, the cited evidence, a confidence level, the gaps.
4. **Precedent table:** organisation, product, platforms and stacks, what they shared, outcome, year, source.
5. **The counter-case:** the strongest argument against the approach, steelmanned.
6. **Open questions and suggested experiments.**
7. **Annotated bibliography:** title, author or org, date, URL, type (paper, engineering blog, talk, docs, vendor), and one or two lines on what it supports.
