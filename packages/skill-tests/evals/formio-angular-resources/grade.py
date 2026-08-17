#!/usr/bin/env python3
"""Grade formio-angular-resources eval runs against assertions.

Reads iteration run outputs from `<repo-root>/.eval-artifacts/formio-angular-resources/`
by default. Override via env vars if your artifacts live elsewhere.

Usage:
    # Default: grade iteration-1 at the default artifacts location
    python grade.py

    # Grade a specific iteration
    ITERATION=iteration-2 python grade.py

    # Point at a different artifacts dir entirely
    ARTIFACTS_DIR=/tmp/my-artifacts ITERATION=iteration-3 python grade.py
"""
import json
import os
import re
import sys
from pathlib import Path

# grade.py lives at packages/skill-tests/evals/formio-angular-resources/grade.py
# — repo root is 5 parents up (harness → evals → skill-tests → packages → root).
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
DEFAULT_ARTIFACTS = REPO_ROOT / ".eval-artifacts" / "formio-angular-resources"
BASE = Path(os.environ.get("ARTIFACTS_DIR", str(DEFAULT_ARTIFACTS)))
ITERATION = os.environ.get("ITERATION", "iteration-1")

STANDALONE_TRUE = re.compile(r"standalone\s*:\s*true")
PARENTS_TEAM = re.compile(r"parents\s*:\s*\[\s*['\"]team['\"]")
PARENTS_USER = re.compile(r"parents\s*:\s*\[\s*['\"]user['\"]")
PARENTS_PROJECT = re.compile(r"parents\s*:\s*\[\s*['\"]project['\"]")
PARENTS_ACCOUNT = re.compile(r"parents\s*:\s*\[\s*['\"]account['\"]")
PARENTS_DEAL = re.compile(r"parents\s*:\s*\[\s*['\"]deal['\"]")
FORM_ACTIVITY = re.compile(r"form\s*:\s*['\"]activity['\"]", re.IGNORECASE)
FORM_USERTEAM = re.compile(r"form\s*:\s*['\"]userTeam['\"]")
FORM_PROJECTUSER = re.compile(r"form\s*:\s*['\"]projectUser['\"]")
NAME_PAT = re.compile(r"name\s*:\s*['\"]([^'\"]+)['\"]")


def read(p):
    try:
        return p.read_text()
    except Exception:
        return ""


def grep_all_ts(root):
    out = {}
    if not root.exists():
        return out
    for p in root.rglob("*.ts"):
        out[p] = read(p)
    return out


def grade_eval_0(out_dir):
    plan = read(out_dir / "phase-a-plan.md")
    ws = out_dir / "workspace"
    ts_files = grep_all_ts(ws)
    all_src = "\n".join(ts_files.values())
    results = []

    results.append({
        "text": "Phase A Scaffolding Plan file was emitted (phase-a-plan.md exists alongside workspace/)",
        "passed": bool(plan.strip()),
        "evidence": f"plan size: {len(plan)} bytes"
    })

    project_mod_file = next((p for p in ts_files if p.name == "project.module.ts" and p.parent.name == "project"), None)
    results.append({
        "text": "A ProjectModule file exists at workspace/src/app/project/project.module.ts",
        "passed": project_mod_file is not None,
        "evidence": str(project_mod_file) if project_mod_file else "not found"
    })

    task_mod_file = next((p for p in ts_files if p.name == "task.module.ts"), None)
    results.append({
        "text": "A TaskModule file exists at workspace/src/app/task/task.module.ts",
        "passed": task_mod_file is not None,
        "evidence": str(task_mod_file) if task_mod_file else "not found"
    })

    pu_mod = next((p for p in ts_files if "project" in str(p) and "user" in str(p) and p.name.endswith(".module.ts") and p.name != "project.module.ts"), None)
    results.append({
        "text": "ProjectUsersModule exists nested under Project (workspace/src/app/project/users/project-users.module.ts or similar)",
        "passed": pu_mod is not None and "project" in str(pu_mod.parent).lower(),
        "evidence": str(pu_mod) if pu_mod else "not found"
    })

    pu_content = read(pu_mod) if pu_mod else ""
    pu_has_project_parent = bool(PARENTS_PROJECT.search(pu_content))
    results.append({
        "text": "The ProjectUsers child module declares parents: ['project'] in its FormioResourceConfig",
        "passed": pu_has_project_parent,
        "evidence": "parents:['project'] present" if pu_has_project_parent else "parents:['project'] absent"
    })

    pu_has_projectUser_form = bool(FORM_PROJECTUSER.search(pu_content))
    forms_found = re.findall(r"form\s*:\s*['\"]([^'\"]+)['\"]", pu_content)
    results.append({
        "text": "The ProjectUsers child module points at form: 'projectUser' (the join form name)",
        "passed": pu_has_projectUser_form,
        "evidence": f"forms in file: {forms_found}"
    })

    root_pu = any(p for p in ts_files if p.parent.name in ("project-user", "projectuser", "project_user") and p.parent.parent.name == "app")
    results.append({
        "text": "No root ProjectUser module exists — the join is ONLY nested under Project, not at top level",
        "passed": not root_pu,
        "evidence": "no root project-user feature folder" if not root_pu else "root project-user folder found"
    })

    has_user_projects_subdir = any(p for p in ts_files if p.parent.name == "projects" and p.parent.parent.name == "user")
    results.append({
        "text": "No /user/:id/projects inverse route exists — ProjectUser mounted on Project side only",
        "passed": not has_user_projects_subdir,
        "evidence": "no user/projects subdir" if not has_user_projects_subdir else "found user/projects"
    })

    project_content = read(project_mod_file) if project_mod_file else ""
    has_push = "children.push" in project_content
    has_users_path = "'users'" in project_content or '"users"' in project_content or "/users" in project_content
    child_route_ok = (has_push or "children:" in project_content) and has_users_path
    results.append({
        "text": "ProjectModule pushes a child route for 'users' onto routes[2].children (or declares it via a static child route)",
        "passed": child_route_ok,
        "evidence": f"children.push={has_push}, refs 'users'={has_users_path}"
    })

    app_mod = next((p for p in ts_files if p.name == "app-module.ts"), None)
    app_content = read(app_mod) if app_mod else ""
    has_resources = "FormioResources" in app_content
    has_authservice = "FormioAuthService" in app_content
    has_appconfig = "FormioAppConfig" in app_content
    providers_ok = has_resources and has_authservice and has_appconfig
    results.append({
        "text": "AppModule provides FormioResources, FormioAuthService, and FormioAppConfig",
        "passed": providers_ok,
        "evidence": f"FormioResources={has_resources} FormioAuthService={has_authservice} FormioAppConfig={has_appconfig}"
    })

    auth_mod = next((p for p in ts_files if p.name == "auth.module.ts"), None)
    auth_content = read(auth_mod) if auth_mod else ""
    config_file = next((p for p in ts_files if p.name in ("config.ts", "app.config.ts")), None)
    config_content = read(config_file) if config_file else ""
    combined = auth_content + app_content + config_content
    references_auth_forms = "userLogin" in combined and "userRegister" in combined
    results.append({
        "text": "AuthModule exists at workspace/src/app/auth/ and references userLogin / userRegister form names",
        "passed": auth_mod is not None and references_auth_forms,
        "evidence": f"auth.module.ts exists: {auth_mod is not None}, userLogin+userRegister found: {references_auth_forms}"
    })

    standalone_count = len(STANDALONE_TRUE.findall(all_src))
    declares_ngmodule = "@NgModule" in all_src
    results.append({
        "text": "Every resource component in the output uses NgModule style with standalone: false (no standalone: true)",
        "passed": standalone_count == 0 and declares_ngmodule,
        "evidence": f"standalone:true occurrences={standalone_count}, @NgModule present={declares_ngmodule}"
    })

    plan_has_tree = "src/app/" in plan or "workspace/" in plan
    plan_has_table = "|" in plan and ("Path" in plan or "Module" in plan or "path" in plan)
    results.append({
        "text": "The Phase A plan emits the file-tree AND a module/route table before any Phase B file is written",
        "passed": plan_has_tree and plan_has_table,
        "evidence": f"tree={plan_has_tree} table={plan_has_table}"
    })

    return results


def grade_eval_1(out_dir):
    plan = read(out_dir / "phase-a-plan.md")
    ws = out_dir / "workspace"
    ts_files = grep_all_ts(ws)
    all_src = "\n".join(ts_files.values())
    results = []

    plan_marks_modify = "MODIFY" in plan.upper() or "merge" in plan.lower() or "modified" in plan.lower()
    results.append({
        "text": "Phase A Scaffolding Plan file was emitted and marks AppModule / AppRoutingModule as MODIFY (not NEW)",
        "passed": bool(plan.strip()) and plan_marks_modify,
        "evidence": f"plan size: {len(plan)}; marks modify/merge: {plan_marks_modify}"
    })

    team_mod = next((p for p in ts_files if p.name == "team.module.ts" and p.parent.name == "team"), None)
    results.append({
        "text": "TeamModule exists at workspace/src/app/team/team.module.ts",
        "passed": team_mod is not None,
        "evidence": str(team_mod) if team_mod else "not found"
    })

    user_mod = next((p for p in ts_files if p.name == "user.module.ts" and p.parent.name == "user"), None)
    results.append({
        "text": "UserModule exists at workspace/src/app/user/user.module.ts",
        "passed": user_mod is not None,
        "evidence": str(user_mod) if user_mod else "not found"
    })

    team_users_mod = next((p for p in ts_files if p.parent.name == "users" and p.parent.parent.name == "team" and p.name.endswith(".module.ts")), None)
    team_users_content = read(team_users_mod) if team_users_mod else ""
    has_team_parent = bool(PARENTS_TEAM.search(team_users_content))
    results.append({
        "text": "A TeamUsers child module exists at workspace/src/app/team/users/ with parents: ['team']",
        "passed": team_users_mod is not None and has_team_parent,
        "evidence": f"path: {team_users_mod}; parents:['team']={has_team_parent}"
    })

    user_teams_mod = next((p for p in ts_files if p.parent.name == "teams" and p.parent.parent.name == "user" and p.name.endswith(".module.ts")), None)
    user_teams_content = read(user_teams_mod) if user_teams_mod else ""
    has_user_parent = bool(PARENTS_USER.search(user_teams_content))
    results.append({
        "text": "A UserTeams child module exists at workspace/src/app/user/teams/ with parents: ['user']",
        "passed": user_teams_mod is not None and has_user_parent,
        "evidence": f"path: {user_teams_mod}; parents:['user']={has_user_parent}"
    })

    tu_has_uform = bool(FORM_USERTEAM.search(team_users_content))
    ut_has_uform = bool(FORM_USERTEAM.search(user_teams_content))
    both_use_userteam = tu_has_uform and ut_has_uform
    results.append({
        "text": "The two sibling join modules share form: 'userTeam' (same underlying join form)",
        "passed": both_use_userteam,
        "evidence": f"TeamUsers form='userTeam': {tu_has_uform}, UserTeams form='userTeam': {ut_has_uform}"
    })

    tu_name_m = NAME_PAT.search(team_users_content)
    ut_name_m = NAME_PAT.search(user_teams_content)
    tu_name = tu_name_m.group(1) if tu_name_m else None
    ut_name = ut_name_m.group(1) if ut_name_m else None
    names_distinct = tu_name and ut_name and tu_name != ut_name
    results.append({
        "text": "The two sibling join modules have DISTINCT name values in FormioResourceConfig (e.g. teamUsers vs userTeams) to avoid FormioResources registry collision",
        "passed": bool(names_distinct),
        "evidence": f"team-users name={tu_name}, user-teams name={ut_name}"
    })

    team_content = read(team_mod) if team_mod else ""
    user_content = read(user_mod) if user_mod else ""
    team_has_push = "children.push" in team_content
    team_refs_users = "'users'" in team_content or '"users"' in team_content
    team_pushes_users = team_has_push and team_refs_users
    results.append({
        "text": "TeamModule pushes a child route for 'users' onto routes[2].children",
        "passed": team_pushes_users,
        "evidence": f"children.push={team_has_push}, refs 'users'={team_refs_users}"
    })

    user_has_push = "children.push" in user_content
    user_refs_teams = "'teams'" in user_content or '"teams"' in user_content
    user_pushes_teams = user_has_push and user_refs_teams
    results.append({
        "text": "UserModule pushes a child route for 'teams' onto routes[2].children",
        "passed": user_pushes_teams,
        "evidence": f"children.push={user_has_push}, refs 'teams'={user_refs_teams}"
    })

    app_mod = next((p for p in ts_files if p.name == "app-module.ts"), None)
    app_content = read(app_mod) if app_mod else ""
    homecomp_still = "HomeComponent" in app_content
    has_resources = "FormioResources" in app_content
    has_authservice = "FormioAuthService" in app_content
    has_approuting = "AppRoutingModule" in app_content
    merge_ok = homecomp_still and has_resources and has_authservice and has_approuting
    results.append({
        "text": "AppModule was MERGED in place — the original HomeComponent declaration and AppRoutingModule import are still present AND FormioResources / FormioAuthService / FormioAppConfig / FormioAuthConfig providers were added",
        "passed": merge_ok,
        "evidence": f"HomeComponent={homecomp_still}, FormioResources={has_resources}, FormioAuthService={has_authservice}, AppRoutingModule={has_approuting}"
    })

    routing_mod = next((p for p in ts_files if p.name == "app-routing-module.ts"), None)
    routing_content = read(routing_mod) if routing_mod else ""
    original_home_route = "HomeComponent" in routing_content
    has_team = "team" in routing_content
    has_user = "user" in routing_content
    has_auth = "auth" in routing_content
    new_routes = has_team and has_user and has_auth
    results.append({
        "text": "AppRoutingModule was MERGED — original HomeComponent route still present AND new routes for team, user, and auth added",
        "passed": original_home_route and new_routes,
        "evidence": f"HomeComponent route={original_home_route}, team={has_team} user={has_user} auth={has_auth}"
    })

    root_ut = any(p for p in ts_files if p.parent.name in ("user-team", "userteam", "user_team") and p.parent.parent.name == "app")
    results.append({
        "text": "No root UserTeam module exists — the join is ONLY nested under the two parents, not at top level",
        "passed": not root_ut,
        "evidence": f"root user-team feature found: {root_ut}"
    })

    standalone_count = len(STANDALONE_TRUE.findall(all_src))
    declares_ngmodule = "@NgModule" in all_src
    results.append({
        "text": "Every component uses NgModule style with standalone: false",
        "passed": standalone_count == 0 and declares_ngmodule,
        "evidence": f"standalone:true occurrences={standalone_count}, @NgModule present={declares_ngmodule}"
    })

    return results


def grade_eval_2(out_dir):
    plan = read(out_dir / "phase-a-plan.md")
    ws = out_dir / "workspace"
    ts_files = grep_all_ts(ws)
    all_src = "\n".join(ts_files.values())
    results = []

    plan_mentions_mirror = any(w in plan.lower() for w in ["mirror", "hidden", "calculated", "server-side"])
    results.append({
        "text": "Phase A Scaffolding Plan file was emitted and explicitly notes that hidden team mirror fields require NO Angular modules or routes",
        "passed": bool(plan.strip()) and plan_mentions_mirror,
        "evidence": f"plan size: {len(plan)}; mentions mirror/hidden/calculated: {plan_mentions_mirror}"
    })

    team_root = any(p for p in ts_files if p.name == "team.module.ts" and p.parent.name == "team")
    account_root = any(p for p in ts_files if p.name == "account.module.ts" and p.parent.name == "account")
    contact_any = any(p for p in ts_files if "contact" in p.name.lower() and p.name.endswith(".module.ts"))
    deal_any = any(p for p in ts_files if "deal" in p.name.lower() and p.name.endswith(".module.ts"))
    results.append({
        "text": "TeamModule, AccountModule, ContactModule, DealModule exist as root-mounted modules",
        "passed": team_root and account_root and contact_any and deal_any,
        "evidence": f"team={team_root} account={account_root} contact-module={contact_any} deal-module={deal_any}"
    })

    root_activity = any(p for p in ts_files if p.name == "activity.module.ts" and p.parent.name == "activity" and p.parent.parent.name == "app")
    results.append({
        "text": "No root ActivityModule — Activity is only accessible through nested mount points",
        "passed": not root_activity,
        "evidence": f"root activity module: {root_activity}"
    })

    team_users_mod = next((p for p in ts_files if p.parent.name == "users" and p.parent.parent.name == "team" and p.name.endswith(".module.ts")), None)
    team_users_content = read(team_users_mod) if team_users_mod else ""
    has_team_parents = bool(PARENTS_TEAM.search(team_users_content))
    results.append({
        "text": "TeamUsers child module exists under team/users/ with parents: ['team']",
        "passed": team_users_mod is not None and has_team_parents,
        "evidence": f"path: {team_users_mod}; parents:['team']={has_team_parents}"
    })

    user_feature = any(p for p in ts_files if p.parent.name == "user" and p.parent.parent.name == "app")
    results.append({
        "text": "No user/* feature module — TeamUser is not mirrored on the user side",
        "passed": not user_feature,
        "evidence": f"src/app/user/ exists: {user_feature}"
    })

    account_mod = next((p for p in ts_files if p.name == "account.module.ts"), None)
    account_content = read(account_mod) if account_mod else ""
    contact_under_account = any(p for p in ts_files if p.name.endswith(".module.ts") and "contact" in p.name.lower() and "account" in str(p))
    account_refs_contacts = "contacts" in account_content or "contact" in account_content
    results.append({
        "text": "ContactModule is nested via account/contacts/ with parents: ['account'] (and/or account/ module pushes a contacts child route)",
        "passed": contact_under_account or account_refs_contacts,
        "evidence": f"contact module under account path={contact_under_account}, account module refs contacts={account_refs_contacts}"
    })

    deal_under_account = any(p for p in ts_files if p.name.endswith(".module.ts") and "deal" in p.name.lower() and "account" in str(p))
    results.append({
        "text": "DealModule is nested via account/deals/ with parents: ['account']",
        "passed": deal_under_account,
        "evidence": f"deal module under account path={deal_under_account}"
    })

    account_activities = next((p for p in ts_files if p.name.endswith(".module.ts") and "activit" in p.name.lower() and "account" in str(p) and "deal" not in str(p).lower()), None)
    acc_act_content = read(account_activities) if account_activities else ""
    acc_act_parents_account = bool(PARENTS_ACCOUNT.search(acc_act_content))
    acc_act_form = bool(FORM_ACTIVITY.search(acc_act_content))
    results.append({
        "text": "An AccountActivities module exists mounted at /account/:id/activities with parents: ['account'] and form: 'activity'",
        "passed": account_activities is not None and acc_act_parents_account and acc_act_form,
        "evidence": f"path: {account_activities}; parents:['account']={acc_act_parents_account}, form=activity: {acc_act_form}"
    })

    deal_activities = next((p for p in ts_files if p.name.endswith(".module.ts") and "activit" in p.name.lower() and "deal" in str(p).lower()), None)
    deal_act_content = read(deal_activities) if deal_activities else ""
    deal_act_parents_deal = bool(PARENTS_DEAL.search(deal_act_content))
    deal_act_form = bool(FORM_ACTIVITY.search(deal_act_content))
    results.append({
        "text": "A DealActivities module exists mounted at /deal/:id/activities with parents: ['deal'] and form: 'activity'",
        "passed": deal_activities is not None and deal_act_parents_deal and deal_act_form,
        "evidence": f"path: {deal_activities}; parents:['deal']={deal_act_parents_deal}, form=activity: {deal_act_form}"
    })

    acc_name_m = NAME_PAT.search(acc_act_content)
    deal_name_m = NAME_PAT.search(deal_act_content)
    acc_name = acc_name_m.group(1) if acc_name_m else None
    deal_name = deal_name_m.group(1) if deal_name_m else None
    names_distinct = acc_name and deal_name and acc_name != deal_name
    results.append({
        "text": "The two Activity sibling modules have DISTINCT name values in FormioResourceConfig (e.g. accountActivities vs dealActivities)",
        "passed": bool(names_distinct),
        "evidence": f"account-activities name={acc_name}, deal-activities name={deal_name}"
    })

    both_form_activity = bool(FORM_ACTIVITY.search(acc_act_content)) and bool(FORM_ACTIVITY.search(deal_act_content))
    results.append({
        "text": "The two Activity sibling modules share the same form: 'activity'",
        "passed": both_form_activity,
        "evidence": f"both reference form:'activity': {both_form_activity}"
    })

    team_parents_matches = [p for p in ts_files if PARENTS_TEAM.search(ts_files[p])]
    non_teamusers_with_team_parent = [p for p in team_parents_matches if "users" not in p.name.lower() and "team-user" not in p.name.lower()]
    violation_names = [p.name for p in non_teamusers_with_team_parent]
    results.append({
        "text": "No module anywhere has parents: ['team'] except the TeamUsers join — the hidden team mirror does NOT produce module-level parent wiring",
        "passed": len(non_teamusers_with_team_parent) == 0,
        "evidence": f"violations: {violation_names}"
    })

    has_calculated = any(w in all_src for w in ["calculateValue", "refreshOn", "calculateOnLoad"])
    has_hidden_prop = bool(re.search(r"hidden\s*:\s*true", all_src))
    results.append({
        "text": "No module emits calculated or hidden field logic (calculateValue, refreshOn, hidden: true) — those are server-side concerns on the form JSON, not Angular modules",
        "passed": not has_calculated and not has_hidden_prop,
        "evidence": f"calculateValue/refreshOn={has_calculated}, hidden:true={has_hidden_prop}"
    })

    standalone_count = len(STANDALONE_TRUE.findall(all_src))
    declares_ngmodule = "@NgModule" in all_src
    results.append({
        "text": "Every component uses NgModule style with standalone: false",
        "passed": standalone_count == 0 and declares_ngmodule,
        "evidence": f"standalone:true occurrences={standalone_count}, @NgModule present={declares_ngmodule}"
    })

    return results


GRADERS = {0: grade_eval_0, 1: grade_eval_1, 2: grade_eval_2}


def resource_modules(ws: Path, ts_files: dict) -> list[Path]:
    """Return every *.module.ts file that looks like a Formio resource module (imports FormioResourceConfig or FormioResource)."""
    out = []
    for p, src in ts_files.items():
        if not p.name.endswith(".module.ts"):
            continue
        if "FormioResourceConfig" in src or "FormioResourceRoutes" in src:
            out.append(p)
    return out


def classify_module(src: str) -> str:
    """Classify how a resource module uses FormioResourceRoutes:
       'bare'         → FormioResourceRoutes() with no options
       'view_pair'    → passes resource: / view: overrides (the browsable-resource pattern)
       'index_only'   → passes index: override only (the join-mount pattern)
       'other'        → passes some options but not classified above
    """
    if re.search(r"FormioResourceRoutes\s*\(\s*\)", src):
        return "bare"
    has_resource = bool(re.search(r"\bresource\s*:", src))
    has_view = bool(re.search(r"\bview\s*:", src))
    has_index = bool(re.search(r"\bindex\s*:", src))
    if has_resource or has_view:
        return "view_pair"
    if has_index:
        return "index_only"
    return "other"


def template_override_assertions(ws: Path, ts_files: dict) -> list[dict]:
    """Every resource module must override UI templates. Browsable resources get ResourceComponent + ViewComponent; join-mount modules get an IndexComponent override."""
    results = []
    rmods = resource_modules(ws, ts_files)
    classifications = {p: classify_module(ts_files[p]) for p in rmods}

    bare = [p for p, c in classifications.items() if c == "bare"]
    results.append({
        "text": "No resource module calls FormioResourceRoutes() bare — every module overrides either the resource/view pair (browsable) or the index (join mount)",
        "passed": len(bare) == 0 and len(rmods) > 0,
        "evidence": f"{len(rmods)} modules; bare calls in: {[p.name for p in bare]}"
    })

    # Browsable resources: require resource.component.html + view/view.component.html with designed content
    browsable = [p for p, c in classifications.items() if c == "view_pair"]
    missing_rc, missing_vc, trivial_view = [], [], []
    for p in browsable:
        feature_dir = p.parent
        rc_html = feature_dir / "resource.component.html"
        vc_html = feature_dir / "view" / "view.component.html"
        if not rc_html.exists():
            missing_rc.append(p)
        if not vc_html.exists():
            missing_vc.append(p)
        else:
            vc_content = read(vc_html)
            vc_text = vc_content.strip()
            is_just_formio = bool(re.match(r"^<formio[^<>]*\[readOnly\][^<>]*>\s*</formio>\s*$", vc_text))
            references_fields = bool(re.search(r"service\.resource\??\.data", vc_content))
            has_meaningful_markup = len(vc_text) > 100 and "<" in vc_text and not is_just_formio
            if is_just_formio or not (references_fields and has_meaningful_markup):
                trivial_view.append(p)

    results.append({
        "text": "Every browsable resource module (view_pair pattern) has a sibling resource.component.html with navigation chrome",
        "passed": len(missing_rc) == 0 and len(browsable) > 0,
        "evidence": f"{len(browsable) - len(missing_rc)}/{len(browsable)} present; missing in: {[p.parent.name for p in missing_rc]}"
    })
    results.append({
        "text": "Every browsable resource module has a sibling view/view.component.html (designed detail page)",
        "passed": len(missing_vc) == 0 and len(browsable) > 0,
        "evidence": f"{len(browsable) - len(missing_vc)}/{len(browsable)} present; missing in: {[p.parent.name for p in missing_vc]}"
    })
    designed_count = len(browsable) - len(trivial_view) - len(missing_vc)
    results.append({
        "text": "Every browsable ViewComponent template is designed — references service.resource?.data.<field> lookups, not just a bare <formio [readOnly]=true> render",
        "passed": len(trivial_view) == 0 and len(missing_vc) == 0 and designed_count > 0,
        "evidence": f"{designed_count}/{len(browsable)} designed; trivial: {[p.parent.name for p in trivial_view]}"
    })

    # Join-mount modules: require a designed index component (subclasses FormioResourceIndexComponent)
    joins = [p for p, c in classifications.items() if c == "index_only"]
    if joins:
        index_designed = []
        index_missing = []
        for p in joins:
            feature_dir = p.parent
            # Look for any *-index.component.ts or index/*.component.ts under this feature
            index_candidates = list(feature_dir.rglob("*index*.component.ts"))
            if not index_candidates:
                index_missing.append(p)
                continue
            # Verify it extends FormioResourceIndexComponent
            if any("FormioResourceIndexComponent" in read(c) for c in index_candidates):
                index_designed.append(p)
            else:
                index_missing.append(p)
        results.append({
            "text": "Every join-mount module (index_only pattern) has a designed IndexComponent override subclassing FormioResourceIndexComponent",
            "passed": len(index_missing) == 0 and len(joins) > 0,
            "evidence": f"{len(index_designed)}/{len(joins)} have designed index; missing/undesigned in: {[p.parent.name for p in index_missing]}"
        })

    return results


def main():
    iteration_dir = BASE / ITERATION
    eval_dirs = sorted(iteration_dir.glob("eval-*"))

    for eval_dir in eval_dirs:
        m = re.match(r"eval-(\d+)", eval_dir.name)
        if not m:
            continue
        eid = int(m.group(1))
        grader = GRADERS.get(eid)
        if not grader:
            continue
        for config in ["with_skill", "without_skill"]:
            out_dir = eval_dir / config / "outputs"
            ws = out_dir / "workspace"
            ts_files = grep_all_ts(ws)
            results = grader(out_dir) + template_override_assertions(ws, ts_files)
            passed = sum(1 for r in results if r["passed"])
            total = len(results)
            failed = total - passed
            # Write in the format the aggregator expects, under run-1/ subdir
            run_dir = eval_dir / config / "run-1"
            # parents=True: an arm may be absent entirely (e.g. baselines carried
            # forward, or a before/after comparison that only populates one arm).
            run_dir.mkdir(parents=True, exist_ok=True)
            grading = {
                "eval_id": eid,
                "configuration": config,
                "expectations": results,
                "summary": {
                    "passed": passed,
                    "failed": failed,
                    "total": total,
                    "pass_rate": passed / total if total else 0
                }
            }
            grading_path = run_dir / "grading.json"
            grading_path.write_text(json.dumps(grading, indent=2))
            # Copy the sibling timing.json into the run-1 dir too
            sibling_timing = eval_dir / config / "timing.json"
            if sibling_timing.exists():
                (run_dir / "timing.json").write_text(sibling_timing.read_text())
            print(f"{eval_dir.name}/{config}: {passed}/{total} ({passed/total*100:.0f}%)")


if __name__ == "__main__":
    main()
