def test_auth_flow(client):
    assert client.get("/api/hostedzones").status_code == 401
    bad = client.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    assert bad.status_code == 401
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/auth/me", headers=h).json()["username"] == "admin"
    assert client.post("/api/auth/logout", headers=h).status_code == 204
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_seeded_zones_and_search(client, auth):
    r = client.get("/api/hostedzones", headers=auth).json()
    assert r["total"] >= 5
    names = [z["name"] for z in r["items"]]
    assert names == sorted(names)
    r = client.get("/api/hostedzones?search=mycompany", headers=auth).json()
    assert r["total"] == 1 and r["items"][0]["name"] == "mycompany.io"
    r = client.get("/api/hostedzones?type=private", headers=auth).json()
    assert all(z["type"] == "private" for z in r["items"])
    r = client.get("/api/hostedzones?page_size=2&page=2", headers=auth).json()
    assert len(r["items"]) == 2 and r["page"] == 2


def test_zone_crud(client, auth):
    r = client.post("/api/hostedzones", headers=auth, json={"name": "Test-Zone.org.", "description": "d"})
    assert r.status_code == 201, r.text
    z = r.json()
    assert z["name"] == "test-zone.org" and z["record_count"] == 2 and len(z["name_servers"]) == 4
    zid = z["id"]
    assert zid.startswith("Z")
    r = client.patch(f"/api/hostedzones/{zid}", headers=auth, json={"description": "new", "tags": [{"key": "a", "value": "b"}]})
    assert r.json()["description"] == "new" and r.json()["tags"] == [{"key": "a", "value": "b"}]
    # invalid name
    assert client.post("/api/hostedzones", headers=auth, json={"name": "bad_-.com-"}).status_code == 400
    # private without vpc
    assert client.post("/api/hostedzones", headers=auth, json={"name": "p.local", "type": "private"}).status_code == 400
    # non-empty zone cannot be deleted
    rec = client.post(f"/api/hostedzones/{zid}/records", headers=auth, json={"name": "www", "type": "A", "ttl": 300, "values": ["1.2.3.4"]})
    assert rec.status_code == 201, rec.text
    r = client.delete(f"/api/hostedzones/{zid}", headers=auth)
    assert r.status_code == 400 and r.json()["detail"]["code"] == "HostedZoneNotEmpty"
    client.delete(f"/api/hostedzones/{zid}/records/{rec.json()['id']}", headers=auth)
    assert client.delete(f"/api/hostedzones/{zid}", headers=auth).status_code == 204
    assert client.get(f"/api/hostedzones/{zid}", headers=auth).status_code == 404


def _zone(client, auth, name):
    return client.post("/api/hostedzones", headers=auth, json={"name": name}).json()["id"]


def test_record_validation_and_crud(client, auth):
    zid = _zone(client, auth, "records-test.com")
    url = f"/api/hostedzones/{zid}/records"
    ok = [
        {"name": "a", "type": "A", "values": ["10.0.0.1"]},
        {"name": "aaaa", "type": "AAAA", "values": ["2001:db8::5"]},
        {"name": "c", "type": "CNAME", "values": ["target.example.net"]},
        {"name": "", "type": "MX", "values": ["10 mx.records-test.com"]},
        {"name": "t", "type": "TXT", "values": ["hello world"]},
        {"name": "sub", "type": "NS", "values": ["ns1.example.net."]},
        {"name": "p", "type": "PTR", "values": ["host.example.com"]},
        {"name": "_x._tcp", "type": "SRV", "values": ["1 10 443 svc.example.com"]},
        {"name": "", "type": "CAA", "values": ['0 issue "letsencrypt.org"']},
    ]
    for body in ok:
        r = client.post(url, headers=auth, json={"ttl": 300, **body})
        assert r.status_code == 201, (body, r.text)
    assert client.get(url + "?search=hello", headers=auth).json()["items"][0]["values"] == ['"hello world"']
    bad = [
        {"name": "x", "type": "A", "values": ["999.1.1.1"]},
        {"name": "x", "type": "AAAA", "values": ["1.2.3.4"]},
        {"name": "x", "type": "MX", "values": ["mx.example.com"]},
        {"name": "x", "type": "SRV", "values": ["1 2 svc"]},
        {"name": "x", "type": "CAA", "values": ["issue foo"]},
        {"name": "", "type": "CNAME", "values": ["apex.example.com"]},  # CNAME at apex
        {"name": "c", "type": "A", "values": ["1.1.1.1"]},  # conflicts with CNAME
        {"name": "a", "type": "A", "values": ["1.1.1.2"]},  # duplicate
        {"name": "x", "type": "A", "values": []},
        {"name": "x", "type": "BOGUS", "values": ["1"]},
    ]
    for body in bad:
        r = client.post(url, headers=auth, json={"ttl": 300, **body})
        assert r.status_code == 400, (body, r.text)
    # filter by type
    items = client.get(url + "?type=A,AAAA", headers=auth).json()["items"]
    assert {i["type"] for i in items} == {"A", "AAAA"}
    # update
    rec = next(i for i in items if i["type"] == "A")
    r = client.put(f"{url}/{rec['id']}", headers=auth, json={"name": "a", "type": "A", "ttl": 60, "values": ["10.0.0.2", "10.0.0.3"]})
    assert r.status_code == 200 and r.json()["ttl"] == 60 and len(r.json()["values"]) == 2
    # default records protected
    all_items = client.get(url, headers=auth).json()["items"]
    soa = next(i for i in all_items if i["type"] == "SOA")
    assert client.delete(f"{url}/{soa['id']}", headers=auth).status_code == 400
    # bulk delete
    ids = [i["id"] for i in all_items if not i["is_default"]]
    r = client.post(url + "/bulk-delete", headers=auth, json={"ids": ids + [soa["id"]]})
    assert len(r.json()["deleted"]) == len(ids) and len(r.json()["failed"]) == 1


def test_routing_and_alias(client, auth):
    zid = _zone(client, auth, "routing-test.com")
    url = f"/api/hostedzones/{zid}/records"
    w = {"name": "w", "type": "A", "ttl": 60, "values": ["1.1.1.1"], "routing_policy": "weighted"}
    assert client.post(url, headers=auth, json=w).status_code == 400  # missing set id
    assert client.post(url, headers=auth, json={**w, "set_identifier": "one", "weight": 10}).status_code == 201
    assert client.post(url, headers=auth, json={**w, "set_identifier": "two", "weight": 90}).status_code == 201
    assert client.post(url, headers=auth, json={**w, "set_identifier": "two", "weight": 90}).status_code == 400
    simple = {"name": "w", "type": "A", "ttl": 60, "values": ["1.1.1.1"]}
    assert client.post(url, headers=auth, json=simple).status_code == 400
    alias = {"name": "al", "type": "A", "alias": True, "alias_target": "w.routing-test.com"}
    r = client.post(url, headers=auth, json=alias)
    assert r.status_code == 201 and r.json()["ttl"] is None
    assert client.get(url + "?alias=true", headers=auth).json()["total"] == 1


def test_batch_is_atomic(client, auth):
    zid = _zone(client, auth, "batch-test.com")
    url = f"/api/hostedzones/{zid}/records/batch"
    r = client.post(url, headers=auth, json={"records": [
        {"name": "ok", "type": "A", "ttl": 1, "values": ["1.1.1.1"]},
        {"name": "bad", "type": "A", "ttl": 1, "values": ["nope"]},
    ]})
    assert r.status_code == 400 and r.json()["detail"]["message"].startswith("Record 2:")
    assert client.get(f"/api/hostedzones/{zid}/records", headers=auth).json()["total"] == 2


def test_bind_import_export(client, auth):
    zid = _zone(client, auth, "bind-test.com")
    zone_file = """$ORIGIN bind-test.com.
$TTL 1h
@   IN SOA ns1.bind-test.com. admin.bind-test.com. ( 1 7200 900 1209600 86400 )
@   IN NS  ns1.bind-test.com.
@       300 IN A 192.0.2.1
www         IN CNAME bind-test.com.
mail    IN A 192.0.2.2
        IN A 192.0.2.3 ; same owner
@       IN MX 10 mail
txt     IN TXT "v=spf1 -all"
"""
    r = client.post(f"/api/hostedzones/{zid}/import", headers=auth, json={"zone_file": zone_file})
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 5 and r.json()["skipped"] == 2
    recs = client.get(f"/api/hostedzones/{zid}/records?search=mail.bind-test.com", headers=auth).json()["items"]
    assert any(i["type"] == "A" and len(i["values"]) == 2 for i in recs)
    bind = client.get(f"/api/hostedzones/{zid}/export?format=bind", headers=auth)
    assert bind.status_code == 200 and "$ORIGIN bind-test.com." in bind.text and "CNAME" in bind.text
    js = client.get(f"/api/hostedzones/{zid}/export?format=json", headers=auth).json()
    assert js["name"] == "bind-test.com" and len(js["records"]) == 7


def test_isolation_between_users(client, auth):
    r = client.get("/api/hostedzones/ZDOESNOTEXIST", headers=auth)
    assert r.status_code == 404 and r.json()["detail"]["code"] == "NoSuchHostedZone"
