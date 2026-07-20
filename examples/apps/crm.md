# CRM

A classic sales CRM. Exercises the full build-new pipeline: multi-resource data model with 1:N relationships, ownership-based access, role separation, and login/registration. A good first smoke test — every step of the orchestrator fires, no exotic auth.

## Prompt

```
/formio-application I want to build a CRM for my consulting practice. I need to keep track of my clients (company name, primary contact, email, phone, industry, and some notes), the deals I'm working on with each client (a name for the deal, its dollar value, what stage it's in — lead, proposal, negotiation, won, or lost — and an expected close date), and a log of activities against each deal (calls, emails, meetings — with a date and a short summary). My two salespeople should each only see their own clients and deals, but I want to see everything as the owner. Put the app in examples/crm-app.
```

## What to look for

- The planner should propose three Resources (Client, Deal, Activity) with Deal → Client and Activity → Deal references, plus a user resource, and an owner-based Access Matrix with a sales role and an admin/owner role.
- "only see their own" should surface as `own`-scoped submission access, not a role guard in the front end.
- After import, framework routing should offer the registered framework (Angular today) and hand off with both template paths.
