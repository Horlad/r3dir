# r3dir 
CLI tool for `r3dir` target-dynamic redirection service which helps bypass weak SSRF filters without redirection location validation.

Read details how `r3dir` works at [Github README page](https://github.com/Horlad/r3dir).

## CLI tool

### Installation
```bash
pip3 install r3dir
```

### Encode mode 
```bash
$ r3dir encode -h
  usage: r3dir encode [-h] [-c STATUS_CODE] [-d MAIN_DOMAIN] [-i IGNORE_PART | -s] [--slient_mode] target_url

positional arguments:
  target_url            Target URL which r3dir tool should redirect to.

options:
  -h, --help            show this help message and exit
  -c STATUS_CODE, --status_code STATUS_CODE
                        HTTP status code of a redirect response.
  -d MAIN_DOMAIN, --main_domain MAIN_DOMAIN
                        Domain where r3dir tool is hosted on.
  -i IGNORE_PART, --ignore_part IGNORE_PART
                        String, which will be ignored during decoding. Used to bypass weak REGEXs.
  -s, --https           HTTPS enforced encoding(TLS certificate length limitation)
  --slient_mode         Slient mode for automations(e.g Hackvertor tags)
```

### Decode mode 
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

## Python package 

You also can use `r3dir.encoder` module to build your own scripts or tools. It contains `encode()` and `decode()` functions which parameters corresponds to CLI options.

Custom errors which encoder or decoder may raise, you can find in `r3dir.exceptions`.
```python
from r3dir.exceptions import BaseCoderError, Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat, TooLongTarget
```

### Examples

- Encoding and decoding with `ignore_part`:

```python
from r3dir import encoder

main_domain = "r3dir.me"
ignore_part = "testingtest "
target, status_code = "http://169.254.169.254", 301

encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, ignore_part=ignore_part)
# encoded_domain = "testingtest.--.62epax5fhvj3zzmzig7q.301.r3dir.me"
decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
# decoded_target, decoded_code = "http://169.254.169.254", 301
```

- HTTPS enforced encoding:

```python
from r3dir import encoder

main_domain = "r3dir.me"
target, status_code = "http://169.254.169.254", 301

encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, http_enforced=true)
# encoded_domain = "62epax5fhvj3zzmzigyoeypkbn7fysllvges3fy.301.r3dir.me"
```

- Slient mode prevents `TooLongTarget` error and produce an "error domain" for decoder with a hash of the long target. Decoding of the error domain will raise an `TooLongTarget` exception with target's hash:

```python
from r3dir import encoder

main_domain = "r3dir.me"
target, status_code = "http://169.254.169.254/latest/meta-data/iam/security-credentials/some_role", 301

encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, http_enforced=true, slient_mode=True)
# encoded_domain = "too-long-target-2b57569cfddb7d6f61331e123da605c7573521c9.301.r3dir.me"
decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
# r3dir.exceptions.TooLongTarget: The target length has been too long for encoder. Target's SHA-1: 2b57569cfddb7d6f61331e123da605c7573521c9
```

