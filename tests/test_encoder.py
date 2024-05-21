import pytest
from r3dir import encoder
from r3dir.exceptions import Base32DecodingError, StatusCodeNotInRangeError, WrongEncodedURLFormat, TooLongTarget

def test_valid_target():
    main_domain = "r3dir.me"
    target, status_code = "http://169.254.169.254", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain)
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert target == decoded_target
    assert status_code == decoded_code

def test_normal_target_with_ignore_part():
    main_domain = "r3dir.me"
    ignore_part = "testingtest"
    target, status_code = "http://169.254.169.254", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, ignore_part=ignore_part)
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert target == decoded_target
    assert status_code == decoded_code

def test_normal_target_with_ignore_part_and_https():
    main_domain = "r3dir.me"
    ignore_part = "testingtest"
    target, status_code = "http://169.254.169.254", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, ignore_part=ignore_part, https_enforced=True)
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert ignore_part not in encoded_domain
    assert target == decoded_target
    assert status_code == decoded_code

def test_normal_empty_encoded_target():
    main_domain = "r3dir.me"
    encoded_domain = "302.r3dir.me"
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert decoded_code == 302
    assert decoded_target == ""

def test_small_main_domain():
    main_domain = "a"
    target, status_code = "http://169.254.169.254", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain)
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert target == decoded_target
    assert status_code == decoded_code

def test_large_main_domain():
    main_domain = "large.adfadf.af.adf.dsaf.ads.f.adsf.adsf.ads.f"
    target, status_code = "http://169.254.169.254", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain)
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert target == decoded_target
    assert status_code == decoded_code

def test_large_main_domain_with_splitter():
    main_domain = "large.adfadf.af.adf.dsaf.ads.f.adsf.test.--.f"
    target, status_code = "http://169.254.169.254", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain)
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert target == decoded_target
    assert status_code == decoded_code

def test_encoder_too_long_target():
    main_domain = "r3dir.me"
    target, status_code = "gopher://metadata.google.internal:80/xGET%20/computeMetadata/v1/instance/attributes/ssh-keys%20HTTP%2f%31%2e%31%0AHost:%20metadata.google.internal%0AAccept:%20%2a%2f%2a%0aMetadata-Flavor:%20Google%0d%0aTestHeader:%20Google", 301
    with pytest.raises(TooLongTarget):
        encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, https_enforced=False)

def test_encoder_too_long_target_with_https_enforced():
    main_domain = "r3dir.me"
    target, status_code = "gopher://metadata.google.internal:80/xGET%20/computeMetadata/v1/instance/attributes/ssh-keys%20HTTP%2f%31%2e%31%0A", 301
    with pytest.raises(TooLongTarget):
        encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, https_enforced=True)

def test_encoder_too_long_target_with_https_enforced_with_slient_mode():
    main_domain = "r3dir.me"
    target, status_code = "gopher://metadata.google.internal:80/xGET%20/computeMetadata/v1/instance/attributes/ssh-keys%20HTTP%2f%31%2e%31%0A", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, https_enforced=True, slient_mode=True)
    assert "too-long-target-" in encoded_domain

def test_encoder_too_long_target_with_slient_mode():
    main_domain = "r3dir.me"
    target, status_code = "gopher://metadata.google.internal:80/xGET%20/computeMetadata/v1/instance/attributes/ssh-keys%20HTTP%2f%31%2e%31%0AHost:%20metadata.google.internal%0AAccept:%20%2a%2f%2a%0aMetadata-Flavor:%20Google%0d%0aTestHeader:%20Google", 301
    encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain, https_enforced=False, slient_mode=True)
    assert "too-long-target-" in encoded_domain

def test_decoder_too_long_target():
    main_domain = "r3dir.me"
    encoded_domain =  "too-long-target-c1ee2cb84dee0891a3788b74cefdbb301ff8791f.301.r3dir.me"
    with pytest.raises(TooLongTarget):
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_too_long_target_with_ignore_part():
    main_domain = "r3dir.me"
    encoded_domain =  "test.--.too-long-target-c1ee2cb84dee0891a3788b74cefdbb301ff8791f.301.r3dir.me"
    with pytest.raises(TooLongTarget):
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_encoder_too_long_target_with_ignore_part():
    ignore_part = "testtest.test"
    main_domain = "r3dir.me"
    target, status_code = "gopher://metadata.google.internal:80/xGET%20/computeMetadata/v1/instance/attributes/ssh-keys%20HTTP%2f%31%2e%31%0AHost:%20metadata.google.internal%0AAccept:%20%2a%2f%2a%0aMetadata-Flavor:%20Google%0d%0a", 301
    with pytest.raises(TooLongTarget):
        encoded_domain = encoder.encode(target, status_code=status_code, ignore_part=ignore_part, main_domain=main_domain, https_enforced=False)

def test_decoder_status_code_out_of_range():
    main_domain = "r3dir.me"
    target, status_code = "http://169.254.169.254", 9999
    with pytest.raises(StatusCodeNotInRangeError):
        encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain)
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_invalid_status_code():
    main_domain = "r3dir.me"
    target, status_code = "http://169.254.169.254", "string_status_code"
    with pytest.raises(WrongEncodedURLFormat):
        encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain)
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_empty_status_code():
    main_domain = "r3dir.me"
    target, status_code = "http://169.254.169.254", ""
    with pytest.raises(WrongEncodedURLFormat):
        encoded_domain = encoder.encode(target, status_code=status_code, main_domain=main_domain)
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_invalid_encoded_target():
    main_domain = "r3dir.me"
    encoded_domain = "non-encoded.302.r3dir.me"
    with pytest.raises(Base32DecodingError):
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    
def test_decoder_empty_encoded_target():
    main_domain = "r3dir.me"
    encoded_domain = ".302.r3dir.me"
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert decoded_target == ""

def test_decoder_empty_encoded_target_with_ignore_part():
    main_domain = "r3dir.me"
    encoded_domain = "test.--.302.r3dir.me"
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert decoded_target == ""

def test_decoder_malformed_ignore_part_splitter():
    main_domain = "r3dir.me"
    encoded_domain = "test.---.302.r3dir.me"
    with pytest.raises(Base32DecodingError):
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_malformed_ignore_part_splitter_2():
    main_domain = "r3dir.me"
    encoded_domain = "test.--62epax5fhvj3zzmzie.302.r3dir.me"
    with pytest.raises(Base32DecodingError):
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_malformed_ignore_part_splitter_3():
    main_domain = "r3dir.me"
    encoded_domain = "test.-.302.r3dir.me"
    with pytest.raises(Base32DecodingError):
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_ignore_part_splitter_in_status_code():
    main_domain = "r3dir.me"
    encoded_domain = '62epax5fhvj3zzmzie.--.r3dir.me'
    with pytest.raises(WrongEncodedURLFormat):
        decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)

def test_decoder_splitted_encoded_subdomains():
    main_domain = "r3dir.me"
    target, status_code = "http://169.254.169.254", 301
    encoded_domain = '62epax5fhv.j3zzmzie.301.r3dir.me'
    decoded_target, decoded_code = encoder.decode(encoded_domain, main_domain=main_domain)
    assert target == decoded_target
    assert status_code == decoded_code