#Python2.7
import subprocess, os.environ
import platform

os_name = platform.system()

MAIN_DOMAIN = "r3dir.me"

SHELL_PATHS = { 
                "Windows": "",
                "Linux": "",
                "Darwin": "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/System/Cryptexes/App/usr/bin"
              }

r3dir_command = ["r3dir" ,"encode", "--slient_mode", "--status_code", status_code, input]

if https:
    r3dir_command.append("--https")

output = subprocess.Popen(*r3dir_command, env=dict(os.environ, PATH=":".join([SHELL_PATHS[os_name], os.environ["PATH"]])))

