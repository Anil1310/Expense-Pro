#!/usr/bin/env python3
"""
🚀 GitHub & Netlify Automation Control Center
Runs directly inside IDE terminal or Mac Desktop Terminal.
"""

import os
import sys
import subprocess
import datetime
import shutil
import json
import re
from urllib.parse import urlencode, urlparse

# Color Codes
CYAN = "\033[1;36m"
GREEN = "\033[1;32m"
YELLOW = "\033[1;33m"
RED = "\033[1;31m"
MAGENTA = "\033[1;35m"
BLUE = "\033[1;34m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DESKTOP_DIR = os.path.expanduser("~/Desktop")


def get_current_project():
    """Detect current project directory."""
    calling = os.environ.get("CALLING_PROJECT_DIR")
    if calling and os.path.isdir(calling) and os.path.exists(os.path.join(calling, ".git")):
        return calling

    if os.path.exists(os.path.join(SCRIPT_DIR, ".git")):
        return SCRIPT_DIR

    # Check if we are in Coaching Demo or another Desktop folder
    current_cwd = os.getcwd()
    if os.path.exists(os.path.join(current_cwd, ".git")):
        return current_cwd

    # Default to Coaching Demo if found on Desktop
    coaching_demo = os.path.join(DESKTOP_DIR, "Coaching Demo")
    if os.path.exists(os.path.join(coaching_demo, ".git")):
        return coaching_demo

    return None


def list_desktop_projects():
    """List all Desktop git projects."""
    projects = []
    if os.path.isdir(DESKTOP_DIR):
        for entry in sorted(os.listdir(DESKTOP_DIR)):
            full_path = os.path.join(DESKTOP_DIR, entry)
            if os.path.isdir(full_path) and os.path.exists(os.path.join(full_path, ".git")):
                if entry not in ("GitHub Automation", "_GitHub Automation"):
                    projects.append(full_path)
    return projects


def select_project():
    """Select active working project."""
    current = get_current_project()
    projects = list_desktop_projects()

    if current and current not in projects:
        projects.insert(0, current)
    elif current in projects:
        # Move current to front
        projects.remove(current)
        projects.insert(0, current)

    if not projects:
        return current or os.getcwd()

    if len(projects) == 1:
        return projects[0]

    return projects[0]


def print_banner(project_path):
    proj_name = os.path.basename(project_path) if project_path else "Workspace"
    branch, remote = get_git_info(project_path) if project_path else ("unknown", None)
    border = "━" * 74
    print(f"\n{CYAN}{border}{RESET}")
    print(f"{CYAN}  {BOLD}DEVOPS CONTROL CENTER{RESET}{CYAN}  /  GitHub · Vercel · Netlify · Apps Script{RESET}")
    print(f"{CYAN}{border}{RESET}")
    print(f"  {DIM}PROJECT{RESET}  {BOLD}{proj_name}{RESET}  {DIM}·  BRANCH{RESET}  {GREEN}{branch}{RESET}")
    print(f"  {DIM}PATH{RESET}     {project_path}")
    print(f"  {DIM}ORIGIN{RESET}   {remote or 'Not configured'}")
    print(f"{CYAN}{border}{RESET}\n")


def print_menu_section(title, options):
    """Print a vertical submenu and return its selected action."""
    print(f"\n{CYAN}{BOLD}  {title}{RESET}")
    print(f"  {DIM}{'─' * 48}{RESET}")
    for menu_number, (_, label, description, icon) in enumerate(options, start=1):
        print(f"  {GREEN}[{menu_number}]{RESET}  {CYAN}{BOLD}{icon} {label}{RESET}")
        print(f"       {DIM}{description}{RESET}")
    print(f"  {DIM}[0]  Back to main menu{RESET}")

    try:
        selection = input(f"\n{YELLOW}{BOLD}  CHOOSE OPTION [0-{len(options)}]: {RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        return None

    if selection == "0":
        return None
    if selection.isdigit() and 1 <= int(selection) <= len(options):
        return str(options[int(selection) - 1][0])

    print(f"{RED}Invalid submenu selection.{RESET}")
    return None


def run_cmd(cmd, cwd=None, check=True):
    """Run shell command with streamed output."""
    try:
        proc = subprocess.run(cmd, shell=True, check=check, text=True, cwd=cwd)
        return proc.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"{RED}Error: {e}{RESET}")
        return False


def get_git_info(project_dir):
    """Get active branch and remote origin."""
    branch_result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True,
        cwd=project_dir
    )
    branch = branch_result.stdout.strip() or "main"

    remote_result = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
        cwd=project_dir
    )
    remote = remote_result.stdout.strip() if remote_result.returncode == 0 else None
    return branch, remote


def get_netlify_site_url(project_dir):
    """Read the configured Netlify site URL for a project."""
    config_path = os.path.join(project_dir, ".netlify-site.json")
    if not os.path.isfile(config_path):
        return None

    try:
        with open(config_path, encoding="utf-8") as config_file:
            config = json.load(config_file)
    except (OSError, json.JSONDecodeError) as error:
        print(f"{RED}Error reading Netlify site configuration: {error}{RESET}")
        return None

    site_url = config.get("siteUrl") if isinstance(config, dict) else None
    if not isinstance(site_url, str):
        print(f"{RED}Error: .netlify-site.json must contain a siteUrl.{RESET}")
        return None

    parsed_url = urlparse(site_url)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        print(f"{RED}Error: Invalid HTTPS siteUrl in .netlify-site.json.{RESET}")
        return None

    return f"{site_url.rstrip('/')}/"


def get_vercel_site_url(project_dir):
    """Read the configured Vercel site URL for a project."""
    config_path = os.path.join(project_dir, ".vercel-site.json")
    if os.path.isfile(config_path):
        try:
            with open(config_path, encoding="utf-8") as f:
                data = json.load(f)
                url = data.get("siteUrl")
                if url:
                    return f"{url.rstrip('/')}/"
        except Exception:
            pass

    if "expense" in os.path.basename(project_dir).lower():
        return "https://expense-pro-rust.vercel.app/"
    return None


def get_vercel_project_name(project_dir):
    """Read configured Vercel project name."""
    config_path = os.path.join(project_dir, ".vercel-site.json")
    if os.path.isfile(config_path):
        try:
            with open(config_path, encoding="utf-8") as f:
                data = json.load(f)
                return data.get("name")
        except Exception:
            pass
    if "expense" in os.path.basename(project_dir).lower():
        return "expense-pro"
    return None


def deploy_vercel(project_dir, auto=False):
    """Deploy project to Vercel (Production)."""
    proj_name = os.path.basename(project_dir)
    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"▲ {BOLD}Deploying to Vercel (Production):{RESET} {GREEN}{proj_name}{RESET}")
    print(f"{CYAN}--------------------------------------------------------{RESET}\n")

    vercel_bin = shutil.which("vercel")
    cmd = [vercel_bin, "--prod"] if vercel_bin else ["npx", "-y", "vercel", "--prod"]
    if auto:
        cmd.append("--yes")

    project_name = get_vercel_project_name(project_dir)
    if project_name:
        cmd.extend(["--project", project_name])

    print(f"{CYAN}Running: {' '.join(cmd)}...{RESET}")
    proc = subprocess.run(cmd, cwd=project_dir)

    live_url = get_vercel_site_url(project_dir) or "https://expense-pro-rust.vercel.app/"
    if proc.returncode == 0:
        print(f"\n{GREEN}{BOLD}🎉 SUCCESS! Deployed to Vercel successfully.{RESET}")
        print(f"👉 {BOLD}{CYAN}{live_url}{RESET}\n")
        try:
            subprocess.run(["open", live_url])
        except Exception:
            pass
    else:
        print(f"\n{YELLOW}If deployment requires authentication, run: npx vercel login{RESET}")
        print(f"Or view project at: {CYAN}{live_url}{RESET}")


def open_vercel_site(project_dir):
    """Open active Vercel site in browser."""
    url = get_vercel_site_url(project_dir) or "https://expense-pro-rust.vercel.app/"
    print(f"\n{CYAN}Opening Vercel site in browser:{RESET} {GREEN}{url}{RESET}")
    try:
        subprocess.run(["open", url])
    except Exception as e:
        print(f"{RED}Could not open browser: {e}{RESET}")


def delete_vercel_project(project_dir):
    """Interactive tool to list and delete Vercel projects."""
    print(f"\n{MAGENTA}================================================================{RESET}")
    print(f"{RED}{BOLD}       🗑️  DELETE VERCEL PROJECT (PERMANENT REMOVAL)            {RESET}")
    print(f"{MAGENTA}================================================================{RESET}\n")

    print(f"{CYAN}Fetching your Vercel projects...{RESET}")
    proc = subprocess.run(["npx", "-y", "vercel", "project", "ls"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    projects = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        m = re.match(r"^([a-z0-9\-_.]+)\s+(https://\S+)", line)
        if m and m.group(1).lower() not in ("project", "name"):
            projects.append({"name": m.group(1), "url": m.group(2)})

    if not projects:
        print(f"{YELLOW}No Vercel projects found on your account.{RESET}\n")
        return

    current_proj_name = get_vercel_project_name(project_dir)

    print(f"{BOLD}Select a Vercel project to permanently delete:{RESET}\n")
    for idx, p in enumerate(projects, start=1):
        is_curr = f" {CYAN}{BOLD}(📍 Linked to local folder){RESET}" if p["name"] == current_proj_name else ""
        print(f"  {YELLOW}[{idx}]{RESET} {BOLD}{p['name']}{RESET} {DIM}➔ {p['url']}{RESET}{is_curr}")

    print(f"\n  {GREEN}[c]{RESET} Cancel / Return\n")

    try:
        ans = input(f"{YELLOW}{BOLD}Enter number of project to DELETE (1-{len(projects)}, or 'c'): {RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        return

    if ans.lower() in ("c", "cancel", "0", "q", ""):
        print(f"\n{GREEN}Exited Vercel delete tool.{RESET}\n")
        return

    chosen = None
    if ans.isdigit() and 1 <= int(ans) <= len(projects):
        chosen = projects[int(ans) - 1]
    else:
        for p in projects:
            if p["name"].lower() == ans.lower():
                chosen = p
                break

    if not chosen:
        print(f"{RED}Invalid selection.{RESET}")
        return

    print(f"\n{RED}{BOLD}⚠️  WARNING: You are about to PERMANENTLY delete:{RESET}")
    print(f"  Project: {BOLD}{chosen['name']}{RESET}")
    print(f"  URL:     {chosen['url']}\n")

    try:
        confirm = input(f"{YELLOW}{BOLD}Type 'yes' or '{chosen['name']}' to confirm deletion: {RESET}").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print(f"\n{YELLOW}Deletion cancelled.{RESET}\n")
        return

    if confirm not in ("yes", "y", chosen["name"].lower()):
        print(f"\n{YELLOW}Deletion cancelled for {chosen['name']}.{RESET}\n")
        return

    print(f"\n{CYAN}Deleting '{chosen['name']}' from Vercel...{RESET}")
    del_proc = subprocess.run(["npx", "-y", "vercel", "project", "rm", chosen["name"]], input="y\n", text=True)

    if del_proc.returncode == 0:
        print(f"\n{GREEN}✅ Project '{chosen['name']}' has been completely removed from Vercel.{RESET}\n")
        if chosen["name"] == current_proj_name:
            cfg = os.path.join(project_dir, ".vercel-site.json")
            if os.path.isfile(cfg):
                try:
                    os.remove(cfg)
                    print(f"{DIM}Unlinked local .vercel-site.json.{RESET}\n")
                except Exception:
                    pass
    else:
        print(f"\n{RED}Failed to delete project '{chosen['name']}'.{RESET}\n")


def quick_push(project_dir):
    """Stage, commit, push, and offer automated deployment."""
    proj_name = os.path.basename(project_dir)
    branch, remote = get_git_info(project_dir)

    if not remote:
        print(f"{RED}❌ No 'origin' remote is configured for this project.{RESET}")
        print("Add your GitHub repository with: git remote add origin <repository-url>")
        return

    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"🚀 {BOLD}Auto-Pushing:{RESET} {GREEN}{proj_name}{RESET} -> {BLUE}{remote}{RESET}")
    print(f"{CYAN}--------------------------------------------------------{RESET}\n")

    print(f"{BLUE}--- Detected Changes ---{RESET}")
    subprocess.run("git status -s", shell=True, cwd=project_dir)
    print(f"{BLUE}------------------------{RESET}\n")

    print(f"{CYAN}Staging all files...{RESET}")
    run_cmd("git add .", cwd=project_dir)

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    commit_msg = f"Auto update: {now_str}"

    diff_check = subprocess.run("git diff-index --quiet HEAD --", shell=True, cwd=project_dir)
    if diff_check.returncode != 0:
        print(f"Creating commit: \"{commit_msg}\"")
        run_cmd(f'git commit -m "{commit_msg}"', cwd=project_dir)
    else:
        print(f"{GREEN}Working tree clean (no new file changes).{RESET}")

    print(f"\n{CYAN}🚀 Pushing to GitHub ({branch})...{RESET}")
    if any(char.isspace() for char in remote):
        corrected_remote = "-".join(remote.split())
        print(f"\n{RED}❌ The origin URL contains spaces and is not a valid GitHub repository URL.{RESET}")
        print(f"Create the matching repository on GitHub, then run:")
        print(f'  git remote set-url origin "{corrected_remote}"')
        return

    success = run_cmd(f"git push origin {branch}", cwd=project_dir)

    if success:
        print(f"\n{GREEN}{BOLD}🎉 SUCCESS! All changes pushed to GitHub successfully.{RESET}")

        print(f"\n{YELLOW}Deploy updated changes to Vercel now? [Y/n]: {RESET}", end="")
        try:
            choice_vercel = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            choice_vercel = "y"

        if choice_vercel in ("", "y", "yes"):
            deploy_vercel(project_dir, auto=True)

        print(f"\n{YELLOW}Deploy updated changes to Netlify now? [y/N]: {RESET}", end="")
        try:
            choice_netlify = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            choice_netlify = "n"

        if choice_netlify in ("y", "yes"):
            deploy_netlify(project_dir, auto=True)
    else:
        print(f"\n{RED}❌ Push failed. Please check remote origin.{RESET}")


def deploy_netlify(project_dir, auto=False):
    """Run Netlify deployment tool."""
    helper_path = os.path.join(project_dir, "Helper_Netlify.js")
    if not os.path.exists(helper_path):
        helper_path = os.path.join(DESKTOP_DIR, "GitHub Automation", "Helper_Netlify.js")

    if not os.path.exists(helper_path):
        print(f"{RED}Error: Helper_Netlify.js not found.{RESET}")
        return

    cmd = ["node", helper_path, project_dir]
    if auto:
        cmd.append("--auto")
    subprocess.run(cmd)


def create_netlify_site(project_dir):
    """Open Netlify's Git import flow for this project's configured build."""
    if not os.path.isfile(os.path.join(project_dir, "netlify.toml")):
        print(f"{RED}Error: netlify.toml not found; configure the project for Netlify first.{RESET}")
        return

    try:
        remote = subprocess.check_output(
            ["git", "remote", "get-url", "origin"],
            cwd=project_dir,
            text=True
        ).strip()
    except subprocess.CalledProcessError:
        print(f"{RED}Error: configure a GitHub origin before connecting this project to Netlify.{RESET}")
        return

    print(f"\n{CYAN}Connect this GitHub repository to Netlify:{RESET}")
    print(f"  Repository: {remote}")
    print("  1. Import this repository in Netlify and authorize GitHub access.")
    print("  2. Keep the build settings from netlify.toml.")
    print("  3. Set APPS_SCRIPT_WEB_APP_URL to your Apps Script /exec URL.")
    print("  4. Deploy the site from Netlify.")
    try:
        subprocess.run(["open", "https://app.netlify.com/start"], check=True)
    except subprocess.CalledProcessError as error:
        print(f"{RED}Could not open Netlify in the browser (exit code {error.returncode}).{RESET}")


def delete_netlify(project_dir):
    """Run Netlify interactive project deletion tool."""
    helper_path = os.path.join(project_dir, "Helper_Netlify.js")
    if not os.path.exists(helper_path):
        helper_path = os.path.join(DESKTOP_DIR, "GitHub Automation", "Helper_Netlify.js")

    if not os.path.exists(helper_path):
        print(f"{RED}Error: Helper_Netlify.js not found.{RESET}")
        return

    subprocess.run(["node", helper_path, project_dir, "--delete"])


def deploy_apps_script(project_dir):
    """Push the Apps Script source and update or create a deployment."""
    if not os.path.isfile(os.path.join(project_dir, ".clasp.json")):
        print(f"{RED}Error: .clasp.json not found; this folder is not linked to an Apps Script project.{RESET}")
        return
    if not os.path.isfile(os.path.join(project_dir, "appsscript.json")):
        print(f"{RED}Error: appsscript.json not found in the selected project.{RESET}")
        return

    clasp = shutil.which("clasp")
    if not clasp:
        print(f"{RED}Error: clasp is not installed or is not available on PATH.{RESET}")
        print("Install it with: npm install -g @google/clasp")
        return

    try:
        print(f"\n{CYAN}Uploading source to Google Apps Script...{RESET}")
        subprocess.run([clasp, "push"], cwd=project_dir, check=True)
        print(f"\n{CYAN}Existing deployments:{RESET}")
        subprocess.run([clasp, "deployments"], cwd=project_dir, check=True)
    except subprocess.CalledProcessError as error:
        print(f"{RED}❌ clasp command failed (exit code {error.returncode}). Check clasp login and project configuration.{RESET}")
        return

    try:
        deployment_id = input(
            f"\n{YELLOW}Deployment ID to update, ENTER to create a new deployment, or 'c' to stop: {RESET}"
        ).strip()
        if deployment_id.lower() in ("c", "cancel"):
            print(f"{YELLOW}Source was pushed, but deployment was not changed.{RESET}")
            return
        description = input(f"{YELLOW}Deployment description [Expense Pro update]: {RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        print(f"\n{YELLOW}Source was pushed, but deployment was not changed.{RESET}")
        return

    description = description or "Expense Pro update"
    command = [clasp, "deploy", "-d", description]
    if deployment_id:
        command.extend(["-i", deployment_id])

    try:
        subprocess.run(command, cwd=project_dir, check=True)
        print(f"\n{GREEN}✅ Apps Script deployment completed.{RESET}")
    except subprocess.CalledProcessError as error:
        print(f"{RED}❌ Apps Script deployment failed (exit code {error.returncode}). The source was pushed, but the deployment was not updated.{RESET}")


def delete_github(project_dir):
    """Run GitHub interactive repository deletion tool."""
    helper_path = os.path.join(project_dir, "Helper_GitHub.js")
    if not os.path.exists(helper_path):
        helper_path = os.path.join(DESKTOP_DIR, "GitHub Automation", "Helper_GitHub.js")

    if not os.path.exists(helper_path):
        print(f"{RED}Error: Helper_GitHub.js not found.{RESET}")
        return

    subprocess.run(["node", helper_path])


def change_github_visibility(project_dir, desired_visibility):
    """Set the selected GitHub repository's visibility."""
    if desired_visibility not in ("public", "private"):
        print(f"{RED}❌ Unsupported repository visibility: {desired_visibility}{RESET}")
        return False

    _, remote = get_git_info(project_dir)
    if not remote:
        print(f"{RED}❌ No 'origin' remote is configured for this project.{RESET}")
        return False

    if remote.startswith("git@github.com:"):
        repo_path = remote.removeprefix("git@github.com:")
    else:
        parsed_remote = urlparse(remote)
        if parsed_remote.hostname != "github.com":
            print(f"{RED}❌ The configured origin is not a GitHub repository: {remote}{RESET}")
            return False
        repo_path = parsed_remote.path.lstrip("/")

    repo_path = repo_path.removesuffix(".git").rstrip("/")
    if len(repo_path.split("/")) != 2 or not all(repo_path.split("/")):
        print(f"{RED}❌ Could not determine the GitHub owner/repository from origin: {remote}{RESET}")
        return False

    gh = shutil.which("gh")
    if not gh:
        print(f"{RED}❌ GitHub CLI ('gh') is not installed or is not available on PATH.{RESET}")
        print("Install it from https://cli.github.com/ and run: gh auth login")
        return False

    view_result = subprocess.run(
        [gh, "repo", "view", repo_path, "--json", "visibility", "--jq", ".visibility"],
        capture_output=True,
        text=True
    )
    if view_result.returncode != 0:
        details = view_result.stderr.strip() or "GitHub CLI could not read this repository."
        print(f"{RED}❌ Unable to read repository visibility: {details}{RESET}")
        print("Check GitHub CLI authentication with: gh auth status")
        return False

    current_visibility = view_result.stdout.strip().lower()
    if current_visibility not in ("public", "private", "internal"):
        print(f"{RED}❌ GitHub returned an unexpected visibility: {view_result.stdout.strip()}{RESET}")
        return False

    print(f"\nRepository: {repo_path}")
    print(f"Current visibility: {current_visibility}")
    if desired_visibility == current_visibility:
        print(f"{GREEN}Repository is already {current_visibility}.{RESET}")
        return True

    if desired_visibility == "public":
        print(f"{YELLOW}Warning: making {repo_path} public allows anyone to view its code and history.{RESET}")

    try:
        confirmation = input(f"Type '{repo_path}' to confirm making it {desired_visibility}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\nVisibility change cancelled.")
        return False
    if confirmation != repo_path:
        print("Confirmation did not match. Visibility was not changed.")
        return False

    edit_result = subprocess.run(
        [
            gh,
            "repo",
            "edit",
            repo_path,
            "--visibility",
            desired_visibility,
            "--accept-visibility-change-consequences"
        ],
        capture_output=True,
        text=True
    )
    if edit_result.returncode != 0:
        details = edit_result.stderr.strip() or edit_result.stdout.strip()
        print(f"{RED}❌ GitHub could not change repository visibility (exit code {edit_result.returncode}).{RESET}")
        if details:
            print(details)
        return False

    verify_result = subprocess.run(
        [gh, "repo", "view", repo_path, "--json", "visibility", "--jq", ".visibility"],
        capture_output=True,
        text=True
    )
    if verify_result.returncode != 0:
        details = verify_result.stderr.strip() or "Could not verify the updated visibility."
        print(f"{YELLOW}⚠️ GitHub accepted the change, but verification failed: {details}{RESET}")
        return False

    verified_visibility = verify_result.stdout.strip().lower()
    if verified_visibility != desired_visibility:
        print(f"{RED}❌ Visibility verification failed; GitHub reports {verified_visibility or 'an unknown value'}.{RESET}")
        return False

    print(f"{GREEN}✅ Repository {repo_path} is now {verified_visibility}.{RESET}")
    return True


def quick_pull(project_dir):
    """Pull latest updates from GitHub."""
    branch, remote = get_git_info(project_dir)
    proj_name = os.path.basename(project_dir)

    if not remote:
        print(f"{RED}❌ Cannot pull updates: no 'origin' remote is configured.{RESET}")
        print("Add your GitHub repository with: git remote add origin <repository-url>")
        return False

    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"⬇️  {BOLD}Pulling updates for:{RESET} {GREEN}{proj_name}{RESET} ({branch})")
    print(f"   Remote: {remote}")
    print(f"{CYAN}--------------------------------------------------------{RESET}\n")

    result = subprocess.run(["git", "pull", "origin", branch], cwd=project_dir)
    if result.returncode != 0:
        print(f"\n{RED}❌ Pull failed (exit code {result.returncode}). The local project was not confirmed up to date.{RESET}")
        return False

    print(f"\n{GREEN}✅ SUCCESS! Local project '{proj_name}' is up to date.{RESET}")
    return True


def create_repository(project_dir):
    """Initialize and create a new GitHub repository."""
    default_name = os.path.basename(project_dir) if project_dir else "my-app"
    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"➕ {BOLD}Create New GitHub Repository{RESET}")
    print(f"{CYAN}--------------------------------------------------------{RESET}\n")

    print(f"Current project folder: {GREEN}{default_name}{RESET} ({project_dir})")
    try:
        repo_name = input(f"{YELLOW}Enter repo name (press [ENTER] for '{default_name}', or 'c' to cancel): {RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        return None

    if repo_name.lower() in ("c", "cancel"):
        return None
    if not repo_name:
        repo_name = default_name

    github_repo_name = "-".join(repo_name.split())
    if not github_repo_name:
        print(f"{RED}❌ Enter a valid GitHub repository name.{RESET}")
        return None

    target_dir = os.path.join(DESKTOP_DIR, repo_name) if repo_name != default_name else project_dir
    os.makedirs(target_dir, exist_ok=True)

    readme_path = os.path.join(target_dir, "README.md")
    if not os.path.exists(readme_path):
        with open(readme_path, "w") as f:
            f.write(f"# {repo_name}\n")

    if not os.path.exists(os.path.join(target_dir, ".git")):
        run_cmd("git init -b main", cwd=target_dir)
    else:
        run_cmd("git branch -M main", cwd=target_dir)

    run_cmd("git add .", cwd=target_dir)
    subprocess.run('git commit -m "Initial commit"', shell=True, cwd=target_dir)
    subprocess.run("git remote remove origin", shell=True, cwd=target_dir)
    remote_url = f"git@github.com:Anil1310/{github_repo_name}.git"
    run_cmd(f'git remote add origin "{remote_url}"', cwd=target_dir)

    print(f"\n{CYAN}Opening GitHub in browser to create remote repository...{RESET}")
    create_url = f"https://github.com/new?{urlencode({'name': github_repo_name})}"
    subprocess.run(["open", create_url])

    print(f"\n{GREEN}>>> Step:{RESET} In your browser, click the green {BOLD}'Create repository'{RESET} button.")
    print(f"    (Leave 'Add a README' unchecked since we already initialized it).")
    try:
        input(f"\n{YELLOW}Once created on GitHub, press [ENTER] to push your code: {RESET}")
    except (EOFError, KeyboardInterrupt):
        return None

    print(f"\n{CYAN}Uploading to GitHub...{RESET}")
    success = run_cmd("git push -u origin main", cwd=target_dir)
    if success:
        repository_url = f"https://github.com/Anil1310/{github_repo_name}"
        print(f"\n{GREEN}🎉 SUCCESS! Repository live at: {repository_url}{RESET}")
        try:
            subprocess.run(["open", repository_url])
        except Exception:
            pass
        return target_dir
    return None


def clone_repository():
    """Clone a GitHub repository into Desktop."""
    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"📥 {BOLD}Clone GitHub Repository{RESET}")
    print(f"{CYAN}--------------------------------------------------------{RESET}\n")

    try:
        repo_input = input(f"{YELLOW}Enter repo name (e.g. my-app) or paste git URL (or 'c' to cancel): {RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        return None

    if not repo_input or repo_input.lower() in ("c", "cancel"):
        return None

    if repo_input.startswith("git@") or repo_input.startswith("https://"):
        clone_url = repo_input
    else:
        clone_url = f"git@github.com:Anil1310/{repo_input}.git"

    print(f"\n{CYAN}Cloning {clone_url} into Desktop...{RESET}")
    success = run_cmd(f'git clone "{clone_url}"', cwd=DESKTOP_DIR)

    if success:
        folder_name = os.path.basename(clone_url).replace(".git", "")
        cloned_path = os.path.join(DESKTOP_DIR, folder_name)
        print(f"\n{GREEN}✅ Repository cloned successfully to: {cloned_path}{RESET}")
        try:
            subprocess.run(f'open "{cloned_path}"', shell=True)
        except Exception:
            pass
        return cloned_path
    else:
        print(f"\n{RED}❌ Failed to clone repository. Please verify the repository name.{RESET}")
        return None


def view_status(project_dir):
    """Display project and deployment details."""
    proj_name = os.path.basename(project_dir)
    branch, remote = get_git_info(project_dir)
    vercel_site_url = get_vercel_site_url(project_dir)
    netlify_site_url = get_netlify_site_url(project_dir)

    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"📊 {BOLD}Project Information & Status{RESET}")
    print(f"{CYAN}--------------------------------------------------------{RESET}")
    print(f"  {BOLD}Project Name:{RESET}     {GREEN}{proj_name}{RESET}")
    print(f"  {BOLD}Directory:{RESET}        {project_dir}")
    print(f"  {BOLD}GitHub Remote:{RESET}    {remote or 'Not configured'}")
    print(f"  {BOLD}Current Branch:{RESET}   {branch}")
    print(f"  {BOLD}Vercel Live URL:{RESET}  {CYAN}{vercel_site_url or 'Not configured'}{RESET}")
    print(f"  {BOLD}Netlify Live URL:{RESET} {CYAN}{netlify_site_url or 'Not configured'}{RESET}\n")

    print(f"{BOLD}Recent Commits:{RESET}")
    subprocess.run('git log -n 4 --format="  • %h | %s (%cr)"', shell=True, cwd=project_dir)

    print(f"\n{BOLD}Working Tree:{RESET}")
    subprocess.run("git status -s", shell=True, cwd=project_dir)


def main():
    target_project = select_project()
    auto_choice = sys.argv[1].strip() if len(sys.argv) > 1 else None
    menu_groups = {
        "1": ("GITHUB", [
            (1, "Quick Push", "Stage, commit, push changes, and auto-deploy", "↑"),
            (2, "Quick Pull", "Fetch and merge the latest remote changes", "↓"),
            (3, "Create Repository", "Create and publish a new GitHub repository", "+"),
            (4, "Clone Repository", "Clone a GitHub repository to your Desktop", "⇩"),
            (5, "Delete Repository", "Permanently delete a GitHub repository", "×"),
        ]),
        "2": ("VERCEL", [
            (6, "Deploy to Vercel", "Deploy production build to Vercel", "▲"),
            (7, "Open Live Vercel Site", "Open live Vercel URL in web browser", "↗"),
            (8, "Delete Vercel Project", "Permanently delete a Vercel project", "×"),
        ]),
        "3": ("NETLIFY", [
            (9, "Deploy Site", "Deploy a project to Netlify", "▲"),
            (10, "Connect GitHub Repository", "Set up a Netlify site from a GitHub repository", "↗"),
            (11, "Delete Netlify Site", "Permanently delete a Netlify project", "×"),
        ]),
        "4": ("GOOGLE APPS SCRIPT", [
            (12, "Deploy Apps Script", "Push source and update or create deployment", "↥"),
        ]),
        "5": ("WORKSPACE", [
            (13, "Project Status", "View recent commits and live deployment URLs", "≡"),
            (14, "Switch Project", "Choose another local Git project", "⇄"),
            (15, "Exit", "Close the automation center", "×"),
        ]),
    }

    while True:
        if auto_choice:
            choice = auto_choice
            auto_choice = None
        else:
            print_banner(target_project)
            print(f"  {DIM}CATEGORIES{RESET}")
            print(f"  {GREEN}[1]{RESET}  {CYAN}{BOLD}GitHub{RESET}               {DIM}Repository and source control{RESET}")
            print(f"  {GREEN}[2]{RESET}  {CYAN}{BOLD}Vercel{RESET}               {DIM}Hosting and production deploys{RESET}")
            print(f"  {GREEN}[3]{RESET}  {CYAN}{BOLD}Netlify{RESET}              {DIM}Hosting and deployments{RESET}")
            print(f"  {GREEN}[4]{RESET}  {CYAN}{BOLD}Google Apps Script{RESET}   {DIM}Script source and deployments{RESET}")
            print(f"  {GREEN}[5]{RESET}  {CYAN}{BOLD}Workspace{RESET}            {DIM}Project tools and exit{RESET}")
            print(f"  {DIM}[0]  Exit{RESET}\n")

            try:
                category = input(f"{YELLOW}{BOLD}  SELECT CATEGORY [0-5]: {RESET}").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nExiting...")
                break

            if category == "0":
                print(f"\n{GREEN}Goodbye! 👋{RESET}\n")
                break

            menu_group = menu_groups.get(category)
            if not menu_group:
                print(f"{RED}Invalid category. Choose a number from 0 to 5.{RESET}")
                continue

            choice = print_menu_section(*menu_group)
            if choice is None:
                continue

        if choice == "1":
            quick_push(target_project)
        elif choice == "2":
            quick_pull(target_project)
        elif choice == "3":
            new_proj = create_repository(target_project)
            if new_proj:
                target_project = new_proj
        elif choice == "4":
            cloned = clone_repository()
            if cloned:
                target_project = cloned
        elif choice == "5":
            delete_github(target_project)
        elif choice == "6":
            deploy_vercel(target_project)
        elif choice == "7":
            open_vercel_site(target_project)
        elif choice == "8":
            delete_vercel_project(target_project)
        elif choice == "9":
            deploy_netlify(target_project)
        elif choice == "10":
            create_netlify_site(target_project)
        elif choice == "11":
            delete_netlify(target_project)
        elif choice == "12":
            deploy_apps_script(target_project)
        elif choice == "13":
            view_status(target_project)
        elif choice == "14":
            all_projs = list_desktop_projects()
            print(f"\n{BOLD}Available Desktop Projects:{RESET}")
            for i, p in enumerate(all_projs, start=1):
                is_curr = f" {CYAN}(📍 Current){RESET}" if p == target_project else ""
                print(f"  [{i}] {os.path.basename(p)}{is_curr}")
            try:
                p_ans = input(f"\n{YELLOW}Choose project (1-{len(all_projs)}): {RESET}").strip()
                if p_ans.isdigit() and 1 <= int(p_ans) <= len(all_projs):
                    target_project = all_projs[int(p_ans) - 1]
                    print(f"{GREEN}Switched to: {os.path.basename(target_project)}{RESET}")
            except (EOFError, KeyboardInterrupt):
                pass
        elif choice in ("15", "q", "exit"):
            print(f"\n{GREEN}Goodbye! 👋{RESET}\n")
            break
        else:
            print(f"{RED}Invalid selection. Please choose a valid option.{RESET}")

        try:
            input(f"\n{DIM}Press [ENTER] to return to menu...{RESET}")
        except (EOFError, KeyboardInterrupt):
            break


if __name__ == "__main__":
    main()
