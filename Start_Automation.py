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
from urllib.parse import urlencode

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
    print(f"\n{MAGENTA}================================================================{RESET}")
    print(f"{CYAN}{BOLD}       🚀 GITHUB & NETLIFY AUTOMATION CONTROL CENTER            {RESET}")
    print(f"{DIM}            Account: Anil1310 (Anil Kumar Chahar)               {RESET}")
    print(f"{MAGENTA}----------------------------------------------------------------{RESET}")
    print(f"  {CYAN}📁 Active Project:{RESET} {BOLD}{GREEN}{proj_name}{RESET}")
    print(f"  {DIM}Path: {project_path}{RESET}")
    print(f"{MAGENTA}================================================================{RESET}\n")


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
    try:
        branch = subprocess.check_output("git branch --show-current", shell=True, text=True, cwd=project_dir).strip() or "main"
        remote = subprocess.check_output("git remote get-url origin", shell=True, text=True, cwd=project_dir).strip()
        return branch, remote
    except Exception:
        return "main", "git@github.com:Anil1310/App.git"


def quick_push(project_dir):
    """Stage, commit, push, and offer interactive Netlify deploy."""
    proj_name = os.path.basename(project_dir)
    branch, remote = get_git_info(project_dir)

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

        print(f"\n{YELLOW}Deploy updated changes to Netlify now? [Y/n]: {RESET}", end="")
        try:
            choice = input().strip().lower()
        except EOFError:
            choice = "y"

        if choice in ("", "y", "yes"):
            deploy_netlify(project_dir)
    else:
        print(f"\n{RED}❌ Push failed. Please check remote origin.{RESET}")


def deploy_netlify(project_dir):
    """Run Netlify interactive project selector (1, 2, 3...)."""
    helper_path = os.path.join(project_dir, "helper_netlify.js")
    if not os.path.exists(helper_path):
        helper_path = os.path.join(DESKTOP_DIR, "GitHub Automation", "helper_netlify.js")

    if not os.path.exists(helper_path):
        print(f"{RED}Error: helper_netlify.js not found.{RESET}")
        return

    subprocess.run(["node", helper_path, project_dir])


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
    helper_path = os.path.join(project_dir, "helper_netlify.js")
    if not os.path.exists(helper_path):
        helper_path = os.path.join(DESKTOP_DIR, "GitHub Automation", "helper_netlify.js")

    if not os.path.exists(helper_path):
        print(f"{RED}Error: helper_netlify.js not found.{RESET}")
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
    helper_path = os.path.join(project_dir, "helper_github.js")
    if not os.path.exists(helper_path):
        helper_path = os.path.join(DESKTOP_DIR, "GitHub Automation", "helper_github.js")

    if not os.path.exists(helper_path):
        print(f"{RED}Error: helper_github.js not found.{RESET}")
        return

    subprocess.run(["node", helper_path])


def quick_pull(project_dir):
    """Pull latest updates from GitHub."""
    branch, remote = get_git_info(project_dir)
    proj_name = os.path.basename(project_dir)
    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"⬇️  {BOLD}Pulling updates for:{RESET} {GREEN}{proj_name}{RESET} ({branch})")
    print(f"   Remote: {remote}")
    print(f"{CYAN}--------------------------------------------------------{RESET}\n")

    run_cmd(f"git pull origin {branch}", cwd=project_dir)
    print(f"\n{GREEN}✅ SUCCESS! Local project '{proj_name}' is up to date.{RESET}")


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
    """Display project and Netlify details."""
    proj_name = os.path.basename(project_dir)
    branch, remote = get_git_info(project_dir)

    print(f"\n{CYAN}--------------------------------------------------------{RESET}")
    print(f"📊 {BOLD}Project Information & Status{RESET}")
    print(f"{CYAN}--------------------------------------------------------{RESET}")
    print(f"  {BOLD}Project Name:{RESET}     {GREEN}{proj_name}{RESET}")
    print(f"  {BOLD}Directory:{RESET}        {project_dir}")
    print(f"  {BOLD}GitHub Remote:{RESET}    {remote}")
    print(f"  {BOLD}Current Branch:{RESET}   {branch}")
    print(f"  {BOLD}Primary Live URL:{RESET} {CYAN}https://divinecoach.netlify.app/{RESET}\n")

    print(f"{BOLD}Recent Commits:{RESET}")
    subprocess.run('git log -n 4 --format="  • %h | %s (%cr)"', shell=True, cwd=project_dir)

    print(f"\n{BOLD}Working Tree:{RESET}")
    subprocess.run("git status -s", shell=True, cwd=project_dir)


def main():
    target_project = select_project()
    auto_choice = sys.argv[1].strip() if len(sys.argv) > 1 else None

    while True:
        if auto_choice:
            choice = auto_choice
            auto_choice = None
        else:
            print_banner(target_project)
            print(f"{BOLD}What would you like to do?{RESET}\n")

            print(f"  {CYAN}{BOLD}--- 🐙 GITHUB AUTOMATION ---{RESET}")
            print(f"  {GREEN}[1]{RESET}  ⚡ {BOLD}Quick Push to GitHub{RESET}     {DIM}(Stage, commit, push changes & optional deploy){RESET}")
            print(f"  {GREEN}[2]{RESET}  ⬇️  {BOLD}Quick Pull from GitHub{RESET}   {DIM}(Pull latest commits from GitHub){RESET}")
            print(f"  {GREEN}[3]{RESET}  ➕ {BOLD}Create New Repository{RESET}    {DIM}(Initialize project & push to GitHub){RESET}")
            print(f"  {GREEN}[4]{RESET}  📥 {BOLD}Clone Repository{RESET}         {DIM}(Download repository from GitHub to Desktop){RESET}")
            print(f"  {RED}[5]{RESET}  🗑️  {BOLD}Delete GitHub Repo{RESET}       {DIM}(Permanently delete GitHub repository){RESET}\n")

            print(f"  {CYAN}{BOLD}--- 🌐 NETLIFY AUTOMATION ---{RESET}")
            print(f"  {GREEN}[6]{RESET}  🚀 {BOLD}Deploy to Netlify{RESET}        {DIM}(Interactive 1, 2, 3 project selector){RESET}")
            print(f"  {GREEN}[7]{RESET}  ✨ {BOLD}Connect GitHub Repo to Netlify{RESET} {DIM}(Import repo and configure a new site){RESET}")
            print(f"  {RED}[8]{RESET}  🗑️  {BOLD}Delete Netlify Project{RESET}   {DIM}(Permanently remove unwanted Netlify site){RESET}\n")

            print(f"  {CYAN}{BOLD}--- 📜 GOOGLE APPS SCRIPT ---{RESET}")
            print(f"  {GREEN}[9]{RESET}  🚀 {BOLD}Deploy Apps Script Update{RESET} {DIM}(clasp push, then update or create deployment){RESET}\n")

            print(f"  {CYAN}{BOLD}--- ⚙️  WORKSPACE & EXIT ---{RESET}")
            print(f"  {GREEN}[10]{RESET} 📊 {BOLD}View Project Info & Status{RESET} {DIM}(Show branch, recent commits, live links){RESET}")
            print(f"  {GREEN}[11]{RESET} 📁 {BOLD}Switch Working Project{RESET}     {DIM}(Select another Desktop project){RESET}")
            print(f"  {RED}[12]{RESET} ❌ {BOLD}Exit{RESET}\n")

            try:
                choice = input(f"{YELLOW}{BOLD}Enter choice (1-12): {RESET}").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nExiting...")
                break

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
            deploy_netlify(target_project)
        elif choice == "7":
            create_netlify_site(target_project)
        elif choice == "8":
            delete_netlify(target_project)
        elif choice == "9":
            deploy_apps_script(target_project)
        elif choice == "10":
            view_status(target_project)
        elif choice == "11":
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
        elif choice in ("12", "q", "exit"):
            print(f"\n{GREEN}Goodbye! 👋{RESET}\n")
            break
        else:
            print(f"{RED}Invalid selection. Please choose 1 to 12.{RESET}")

        try:
            input(f"\n{DIM}Press [ENTER] to return to menu...{RESET}")
        except (EOFError, KeyboardInterrupt):
            break


if __name__ == "__main__":
    main()
