# Learnings — Jenkins to GitHub Actions Migration Project

A personal reference of concepts explained during this project.
Every time something was unclear, it was explained and documented here.

---

## 1. Jenkins vs GitHub Actions

**Jenkins** is a self-hosted automation server.
- You install it on your own machine or server
- You maintain it (updates, plugins, storage)
- Your pipelines run on your own hardware

**GitHub Actions** is the same idea, but GitHub hosts everything.
- No installation needed
- Your pipeline is just a YAML file inside your repo
- GitHub runs it on their servers (called "runners") for free (2000 min/month)

### Migration Map

| Jenkins | GitHub Actions |
|---------|---------------|
| Jenkinsfile | `.github/workflows/ci-cd.yml` |
| Job (e.g. swagger-job) | a `job:` block inside the workflow |
| Build trigger | `on: push` / `on: pull_request` |
| Build step | a `step:` inside a job |
| Slave / Agent | `runs-on: ubuntu-latest` |

---

## 2. Key GitHub Actions Terms

**Workflow** — the entire pipeline. Lives in `.github/workflows/`. Triggered by events like a push or PR.

**Job** — a group of steps. Jobs run on a fresh machine (runner). Multiple jobs can run in parallel or in sequence.

**Step** — a single task inside a job. Either runs a shell command (`run:`) or uses a pre-built action (`uses:`).

**Runner** — the virtual machine GitHub provides to run your job. `ubuntu-latest` is the most common.

**Trigger (`on:`)** — what causes the workflow to start. Examples: `push`, `pull_request`, `workflow_dispatch` (manual button).

**needs:** — makes one job wait for another to finish. If the first job fails, the second job is skipped.

---

## 3. Dockerfile — Line by Line

A Dockerfile is a recipe that tells Docker how to package your app into a portable image.

An **image** is like a snapshot of your app + everything it needs to run (OS, Node.js, your code, dependencies).
A **container** is a running instance of that image. Like: image = recipe, container = the actual cooked dish.

### Why two stages?

We use a **multi-stage build** to keep the final image small and clean.
- Stage 1 (`deps`) installs all packages
- Stage 2 copies only what's needed to run the app (no build tools, no dev dependencies)

```dockerfile
# ── STAGE 1: Install dependencies ──────────────────────────────

FROM node:20-alpine AS deps
```
`FROM` = start from a base image (a pre-built OS + runtime).
`node:20-alpine` = tiny Linux (Alpine, ~5MB) with Node.js 20 already installed.
`AS deps` = name this stage "deps" so Stage 2 can reference it.

```dockerfile
WORKDIR /app
```
Set the working directory inside the container to `/app`.
Every command after this runs from `/app`. Same as doing `cd /app`.

```dockerfile
COPY package*.json ./
```
Copy `package.json` and `package-lock.json` from your machine into the container.
`*` = matches both files in one line.
**Why copy this before source code?** Docker caches each line. If your code changes but `package.json` didn't, Docker reuses the cached `node_modules` and skips reinstalling — making builds much faster.

```dockerfile
RUN npm ci --only=production
```
`RUN` = execute a shell command while building.
`npm ci` = clean install using the lockfile exactly (faster and stricter than `npm install`).
`--only=production` = skip dev tools like jest and nodemon. Not needed to run the app.

```dockerfile
# ── STAGE 2: Run the app ────────────────────────────────────────

FROM node:20-alpine
```
Start fresh with a clean Alpine image. No leftover files from Stage 1.

```dockerfile
WORKDIR /app
```
Same as before — set working directory to `/app`.

```dockerfile
COPY --from=deps /app/node_modules ./node_modules
```
Copy `node_modules` from Stage 1 into this stage.
We get all installed packages without running `npm install` again.

```dockerfile
COPY src/ ./src/
```
`COPY <source on your machine>  <destination inside the container>`
Copies your `src/` folder into `/app/src/` inside the container.

```dockerfile
EXPOSE 3000
```
Documents that the app listens on port 3000.
This does NOT actually open the port — it's a label for whoever runs the container.

```dockerfile
CMD ["node", "src/index.js"]
```
The command that runs when the container starts.
Equivalent to typing `node src/index.js` in your terminal.
Only one `CMD` allowed per Dockerfile — it's the entry point of your app.

---

## 4. What is Swagger / OpenAPI?

**The problem it solves:**
When you build an API, other developers (or your future self) need to know:
- What endpoints exist?
- What data do I send?
- What does the response look like?
- What errors can happen?

Without documentation, they have to read your code. That's slow and error-prone.

**OpenAPI (also called Swagger) is a standard way to document your API in a YAML file.**
Instead of writing a Word doc or README paragraph, you write a structured file that describes every endpoint, every request, and every response.

**Why it matters in CI/CD:**
The `swagger-job` in Jenkins (and our `swagger` job in GitHub Actions) validates this file automatically on every push.
If a developer documents the wrong response code or forgets a required field, the pipeline catches it before it reaches production.

**Bonus:** Tools like Swagger UI can read this file and generate an interactive webpage where anyone can test your API without writing any code.

---

## 5. What is a Test File? (tests/entries.test.js)

**The problem it solves:**
When you write code, how do you know it works correctly? You could manually open Postman and try every endpoint. But if you have 50 endpoints and 3 developers pushing code every day, you can't manually check everything every time.

**A test file is code that automatically checks your code.**
You write it once. Every time someone pushes new code, the tests run automatically and tell you: everything still works — or something broke.

### What does entries.test.js actually do?

It pretends to be a real user calling your API and checks the responses.

Example:
```js
it("rejects negative calories", async () => {
  const res = await request(app)
    .post("/entries")
    .send({ name: "Rice", calories: -100 });
  expect(res.statusCode).toBe(400);
});
```
In plain English: "Send a POST request with negative calories. I **expect** the server to return 400 (Bad Request). If it doesn't — the test fails."

### Why do we need it in this project?

In our GitHub Actions workflow, the `swagger` job runs `npm test` before any deployment:

```
Developer pushes code
        ↓
swagger job runs npm test
        ↓
   All pass? ✓              Any fail? ✗
        ↓                        ↓
cloudformation job runs     Pipeline stops.
App gets deployed           Nothing deployed. Broken code stays out of production.
```

### Real-world analogy

Think of tests like a **quality check on a factory line**.
Before a product leaves the factory, a machine inspects it.
If it's defective, it gets pulled out — only good products ship.

Your tests are that quality check. Your pipeline is the factory line.

### Tools used

- **Jest** — the testing framework. Runs your test files and reports pass/fail.
- **Supertest** — lets you make fake HTTP requests to your Express app without actually starting a server.

---

## 6. Difference Between Swagger and Tests — and How Swagger Validates

### They check completely different things

| | Tests (entries.test.js) | Swagger (openapi.yml) |
|--|--|--|
| What it checks | Does the code logic work? | Is the documentation file written correctly? |
| Does it run your code? | Yes | No |
| Does it call your API? | Yes (fake requests) | No |

### How does Swagger validation actually work?

The Swagger validator does NOT call your API or run your code.
It only checks: **is the `openapi.yml` file written correctly according to OpenAPI rules?**

Think of it like a **spell checker for your documentation file**.
A spell checker doesn't know if your essay is factually correct.
It only checks if words are spelled right and grammar follows rules.
Similarly, the Swagger validator checks if your YAML follows the OpenAPI standard.

Example of what it catches:
```yaml
# WRONG - validator will fail
paths:
  /entries:
    post:
      responses:
        201:            # ← should be '201' (string) not 201 (number)
          description:  # ← description cannot be empty
```
```yaml
# WRONG - validator will fail
schema:
  type: objects   # ← "objects" is not valid, must be "object"
```

### The gap — what Swagger validation does NOT catch

It won't catch this situation:
- Your `openapi.yml` says `POST /entries` returns `201`
- But your actual code returns `200`
- Validator says ✓ (the YAML is valid OpenAPI format)
- But reality doesn't match the docs

To catch THAT problem, companies use **contract testing** (tools like Dredd or Schemathesis).
That actually starts your server, reads the swagger file, and fires real requests to check if your code matches your docs.
That's an advanced topic — for now we do spec validation only.

### Full picture of what each tool checks

| Tool | What it checks |
|------|---------------|
| `entries.test.js` (Jest) | Does your code logic work correctly? |
| Swagger validator (Redocly) | Is your `openapi.yml` written in valid OpenAPI format? |
| Contract testing (Dredd) | Does your actual running API match what `openapi.yml` promises? |

We are doing the first two in this project. Contract testing is a step further that most teams add later.

---

## 7. What is CloudFormation and What Does It Automate?

### What is CloudFormation?

CloudFormation is AWS's tool for creating infrastructure using a YAML file instead of clicking around in the AWS console manually.

**Without CloudFormation:**
- Go to AWS console → click "create EC2" → click "create security group" → click "attach role" → ...
- Nobody knows exactly what was created
- Can't recreate it if it breaks
- Easy to make mistakes

**With CloudFormation:**
- Everything is described in one YAML file (`template.cfn.yml`)
- One command creates your entire AWS setup
- It's version controlled — you can see every change in git history
- Anyone can recreate the exact same setup from scratch

This is called **Infrastructure as Code (IaC)** — treating your infrastructure the same way you treat your application code.

### What does our CloudFormation template create?

For the calorie tracker, one `aws cloudformation deploy` command automates all of this:

```
1. Security Group  →  Firewall rules
                      Allow port 3000 (your app) from the internet
                      Allow port 22 (SSH) so you can log into the server

2. IAM Role        →  Permissions for the EC2 instance
                      e.g. allowed to pull Docker images, write logs

3. EC2 Instance    →  A virtual Linux server on AWS
                      Attached to the Security Group
                      Runs a startup script (User Data) automatically when it boots

   Startup script does:
   → installs Docker
   → pulls your Docker image from DockerHub
   → runs your container on port 3000
```

### The full automation chain

```
You push code to GitHub
        ↓
GitHub Actions: swagger job
→ runs tests, validates openapi spec
        ↓
GitHub Actions: cloudformation job
→ builds Docker image
→ pushes image to DockerHub
→ runs: aws cloudformation deploy
        ↓
AWS CloudFormation
→ creates Security Group (firewall)
→ creates IAM Role (permissions)
→ creates EC2 instance
→ EC2 boots up and runs the startup script
→ startup script pulls your Docker image and runs it
        ↓
Your calorie tracker is live on the internet
```

### CloudFormation is smart about updates

If you run it a second time (e.g. you pushed new code), it does NOT create a second EC2 instance.
It compares what already exists on AWS with what your template describes, and only changes what's different.
This is called a **changeset** — only the delta gets applied.

---
