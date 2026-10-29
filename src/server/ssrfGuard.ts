import dns from 'node:dns/promises';

// Strict host allowlist
export const ALLOWED_PORTAL_HOSTS = new Set([
  'scholarships.gov.in',
  'upsconline.nic.in',
  'upsc.gov.in',
  'nta.ac.in',
  'ugcnet.nta.ac.in',
  'pmrf.in',
  'swayam.gov.in',
  'digilocker.gov.in'
]);

// IP blocking helper
export function isPrivateOrReservedIP(ip: string): boolean {
  // IPv4 checks
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [_, a, b] = ipv4Match.map(Number);
    if (a === 127) return true; // Loopback 127.0.0.0/8
    if (a === 10) return true; // Private 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // Private 172.16.0.0/12
    if (a === 192 && b === 168) return true; // Private 192.168.0.0/16
    if (a === 169 && b === 254) return true; // Link-local 169.254.0.0/16
    if (a === 0) return true; // Broadcast / zero 0.0.0.0/8
    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true; // Loopback
  if (lower.startsWith('fe80:')) return true; // Link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // Unique local address (fc00::/7)
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;

  return false;
}

export interface ProbeResult {
  status: 'reachable' | 'degraded' | 'issue' | 'unknown' | 'monitoring_unavailable';
  httpStatus: number | null;
  latencyMs: number;
  testedScope: string;
  notes: string;
}

export async function validateAndProbePortalUrl(rawUrl: string, maxRedirects = 2): Promise<ProbeResult> {
  const startTime = Date.now();
  let currentUrl = rawUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return {
        status: 'issue',
        httpStatus: null,
        latencyMs: Date.now() - startTime,
        testedScope: 'url_syntax_validation',
        notes: 'Invalid portal URL format.'
      };
    }

    // Protocol check
    if (parsed.protocol !== 'https:') {
      return {
        status: 'issue',
        httpStatus: null,
        latencyMs: Date.now() - startTime,
        testedScope: 'protocol_validation',
        notes: 'Security violation: Only verified HTTPS endpoints are permitted for government portal monitoring.'
      };
    }

    // Host allowlist check
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_PORTAL_HOSTS.has(hostname)) {
      return {
        status: 'issue',
        httpStatus: null,
        latencyMs: Date.now() - startTime,
        testedScope: 'host_allowlist_validation',
        notes: `Access restricted: Host "${hostname}" is not on the government allowlist.`
      };
    }

    // DNS resolution & private IP rejection
    try {
      const lookupResult = await dns.lookup(hostname, { all: true });
      for (const entry of lookupResult) {
        if (isPrivateOrReservedIP(entry.address)) {
          return {
            status: 'issue',
            httpStatus: null,
            latencyMs: Date.now() - startTime,
            testedScope: 'dns_security_validation',
            notes: 'Security alert: Host resolves to internal or reserved IP address.'
          };
        }
      }
    } catch (dnsErr: any) {
      return {
        status: 'issue',
        httpStatus: null,
        latencyMs: Date.now() - startTime,
        testedScope: 'dns_resolution',
        notes: `DNS resolution failed for ${hostname}: ${dnsErr.message || 'Host unreachable'}.`
      };
    }

    // Perform bounded HEAD probe with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const probeStart = Date.now();
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual', // handle redirects explicitly
        headers: {
          'User-Agent': 'MargdarshakCivicPortalAudit/1.0 (+https://margdarshak.gov.in/audit)'
        }
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - probeStart;

      // Handle redirect
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            status: 'issue',
            httpStatus: response.status,
            latencyMs,
            testedScope: 'homepage_tls_head_only',
            notes: 'Redirect status received without Location header.'
          };
        }
        currentUrl = new URL(location, currentUrl).toString();
        redirectsCount++;
        continue; // loop to revalidate redirected host
      }

      // Classify response
      let status: ProbeResult['status'] = 'reachable';
      let notes = 'Portal root endpoint responded nominally. Transactional services (OTP, login, upload) not verified in automated scope.';

      if (response.status >= 500) {
        status = 'issue';
        notes = `Portal returned server error (HTTP ${response.status}).`;
      } else if (response.status >= 400) {
        status = 'degraded';
        notes = `Portal returned client restriction (HTTP ${response.status}).`;
      } else if (latencyMs > 2500) {
        status = 'degraded';
        notes = `High response latency (${latencyMs}ms). Users may experience slow page loads.`;
      }

      return {
        status,
        httpStatus: response.status,
        latencyMs,
        testedScope: 'homepage_tls_head_only',
        notes
      };

    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      if (fetchErr.name === 'AbortError') {
        return {
          status: 'issue',
          httpStatus: null,
          latencyMs,
          testedScope: 'homepage_tls_head_only',
          notes: 'Portal request timed out after 3000ms threshold.'
        };
      }

      return {
        status: 'issue',
        httpStatus: null,
        latencyMs,
        testedScope: 'homepage_tls_head_only',
        notes: `Connection failed: ${fetchErr.message || 'Network unreachable'}`
      };
    }
  }

  return {
    status: 'issue',
    httpStatus: null,
    latencyMs: Date.now() - startTime,
    testedScope: 'redirect_chain_validation',
    notes: 'Exceeded maximum allowable redirect hops.'
  };
}
