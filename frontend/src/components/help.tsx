export const HELP = {
  hostedZones: {
    title: "Hosted zones",
    body: (
      <>
        <p>
          A <strong>hosted zone</strong> is a container for records, and records contain information about how you want
          to route traffic for a specific domain, such as example.com, and its subdomains.
        </p>
        <p>
          <strong>Public hosted zones</strong> contain records that specify how you want to route traffic on the
          internet. <strong>Private hosted zones</strong> contain records that specify how you want to route traffic in
          an Amazon VPC.
        </p>
        <p>When you create a hosted zone, Route 53 automatically creates a name server (NS) record and a start of authority (SOA) record for the zone.</p>
      </>
    ),
  },
  createZone: {
    title: "Create hosted zone",
    body: (
      <>
        <p>Enter the name of the domain that you want to route traffic for, such as example.com.</p>
        <p>Domain names can contain letters a-z, numbers 0-9, hyphens and periods. Labels can&apos;t start or end with a hyphen.</p>
      </>
    ),
  },
  records: {
    title: "Records",
    body: (
      <>
        <p>
          Records define how you want to route traffic for a domain. Each record includes the name of a domain or
          subdomain, a record type (for example, A or MX), and other information applicable to the record type.
        </p>
        <h3>Routing policies</h3>
        <ul>
          <li><strong>Simple</strong> – route to a single resource.</li>
          <li><strong>Weighted</strong> – split traffic in proportions that you specify.</li>
          <li><strong>Latency</strong> – route to the Region with the best latency.</li>
          <li><strong>Failover</strong> – active-passive failover.</li>
          <li><strong>Geolocation</strong> – route based on the location of users.</li>
          <li><strong>Multivalue answer</strong> – respond with up to eight healthy records.</li>
        </ul>
      </>
    ),
  },
  recordValue: {
    title: "Value",
    body: (
      <>
        <p>Enter one value per line. Format depends on the record type:</p>
        <ul>
          <li><strong>A</strong> – IPv4 address, e.g. 192.0.2.235</li>
          <li><strong>AAAA</strong> – IPv6 address, e.g. 2001:0db8:85a3::8a2e:0370:7334</li>
          <li><strong>CNAME</strong> – domain name, e.g. www.example.com</li>
          <li><strong>MX</strong> – priority and mail server, e.g. 10 mail.example.com</li>
          <li><strong>TXT</strong> – text in quotation marks, e.g. &quot;v=spf1 -all&quot;</li>
          <li><strong>NS</strong> – name server, e.g. ns-1.awsdns-01.org</li>
          <li><strong>PTR</strong> – domain name, e.g. hostname.example.com</li>
          <li><strong>SRV</strong> – priority weight port host, e.g. 1 10 5269 xmpp.example.com</li>
          <li><strong>CAA</strong> – flags tag &quot;value&quot;, e.g. 0 issue &quot;amazon.com&quot;</li>
        </ul>
      </>
    ),
  },
  importZone: {
    title: "Import zone file",
    body: (
      <>
        <p>Paste the contents of a BIND-formatted zone file. Route 53 creates a record for each supported record in the file.</p>
        <p>SOA records and NS records at the zone apex are ignored, because Route 53 creates them automatically. Records that already exist are skipped.</p>
      </>
    ),
  },
} as const;
