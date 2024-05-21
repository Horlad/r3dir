const { encode, decode } = require('./encoder.js');

describe('encoder and decoder tests', () => {
  const mainDomain = "r3dir.me";

  test('valid target', () => {
    const target = "http://169.254.169.254";
    const statusCode = 301;
    const encodedDomain = encode(target, statusCode, mainDomain);
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedTarget).toBe(target);
    expect(decodedCode).toBe(statusCode);
  });

  test('normal target with ignore part', () => {
    const ignorePart = "testingtest";
    const target = "http://169.254.169.254";
    const statusCode = 301;
    const encodedDomain = encode(target, statusCode, mainDomain, ignorePart);
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedTarget).toBe(target);
    expect(decodedCode).toBe(statusCode);
  });

  test('normal target with ignore part and https', () => {
    const ignorePart = "testingtest";
    const target = "http://169.254.169.254";
    const statusCode = 301;
    expect(() => {
      encode(target, statusCode, mainDomain, ignorePart, true);
    }).toThrow('The target length is longer than maximum allowed for HTTPS mode. Remove ignoring part, or short the target.');
  });

  test('normal empty encoded target', () => {
    const encodedDomain = "302.r3dir.me";
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedCode).toBe(302);
    expect(decodedTarget).toBe("");
  });

  test('status code out of range', () => {
    const target = "http://169.254.169.254";
    const statusCode = 9999;
    expect(() => {
      const encodedDomain = encode(target, statusCode, mainDomain);
      decode(encodedDomain, mainDomain);
    }).toThrow('Status code is not in [200, 600) range');
  });

  test('small main domain', () => {
    const mainDomain = "a";
    const target = "http://169.254.169.254";
    const statusCode = 301;
    const encodedDomain = encode(target, statusCode, mainDomain);
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedTarget).toBe(target);
    expect(decodedCode).toBe(statusCode);
  });

  test('large main domain', () => {
    const mainDomain = "large.adfadf.af.adf.dsaf.ads.f.adsf.adsf.ads.f";
    const target = "http://169.254.169.254";
    const statusCode = 301;
    const encodedDomain = encode(target, statusCode, mainDomain);
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedTarget).toBe(target);
    expect(decodedCode).toBe(statusCode);
  });

  test('encoder too long target', () => {
    const target = "gopher://metadata.google.internal:80/xGET%20/computeMetadata/v1/instance/attributes/ssh-keys%20HTTP%2f%31%2e%31%0AHost:%20metadata.google.internal%0AAccept:%20%2a%2f%2a%0aMetadata-Flavor:%20Google%0d%0aTestHeader:%20Google";
    const statusCode = 301;
    expect(() => {
      encode(target, statusCode, mainDomain);
    }).toThrow('The target length is longer than maximum allowed.');
  });

  test('encoder too long target with https enforced', () => {
    const target = "gopher://metadata.google.internal:80/xGET%20/computeMetadata/v1/instance/attributes/ssh-keys%20HTTP%2f%31%2e%31%0A";
    const statusCode = 301;
    expect(() => {
      encode(target, statusCode, mainDomain,null, true);
    }).toThrow('The target length is longer than maximum allowed for HTTPS mode. Remove ignoring part, or short the target.');
  });

  test('decoder invalid status code', () => {
    const target = "http://169.254.169.254";
    const statusCode = "string_status_code";
    expect(() => {
      const encodedDomain = encode(target, statusCode, mainDomain);
      const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    }).toThrow("Can't read status code.");
  });

  test('decoder empty status code', () => {
    const target = "http://169.254.169.254";
    const statusCode = "";
    expect(() => {
      const encodedDomain = encode(target, statusCode, mainDomain);
      const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    }).toThrow("Can't read status code.");
  });

  test('decoder empty encoded target', () => {
    const encodedDomain = ".302.r3dir.me";
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedTarget).toBe("");
    expect(decodedCode).toBe(302);
  });

  test('decoder empty encoded target with ignore part', () => {
    const encodedDomain = "test.--.302.r3dir.me";
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedTarget).toBe("");
    expect(decodedCode).toBe(302);
  });

  test('decoder ignore part splitter in status code', () => {
    const encodedDomain = '62epax5fhvj3zzmzie.--.r3dir.me';
    expect(() => {
      decode(encodedDomain, mainDomain);
    }).toThrow("Can't read status code.");
  });

  test('decoder splitted encoded subdomains', () => {
    const target = "http://169.254.169.254";
    const statusCode = 301;
    const encodedDomain = '62epax5fhv.j3zzmzie.301.r3dir.me';
    const [decodedTarget, decodedCode] = decode(encodedDomain, mainDomain);
    expect(decodedTarget).toBe(target);
    expect(decodedCode).toBe(statusCode);
  });
});