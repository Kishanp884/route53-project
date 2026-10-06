"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/route53/v2/dashboard";
  const [kind, setKind] = useState("iam");
  const [accountId, setAccountId] = useState("123456789012");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(next.startsWith("/login") ? "/route53/v2/dashboard" : next);
  }, [loading, user, next, router]);

  const submit = async () => {
    setError(null);
    if (!username || !password) {
      setError("Enter your user name and password.");
      return;
    }
    setBusy(true);
    try {
      await login(username, password, kind === "iam" ? accountId : undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 48 }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 16px", boxSizing: "border-box" }}>
        <SpaceBetween size="l">
          <Box textAlign="center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={48} height={48} />
            <Box variant="h1" padding={{ top: "s" }}>
              Route 53 Console
            </Box>
            <Box color="text-body-secondary" fontSize="body-s">
              Educational clone — not affiliated with Amazon Web Services
            </Box>
          </Box>
          {params.get("signedout") && <Alert type="success">You have signed out.</Alert>}
          <Container header={<Header variant="h2">Sign in</Header>}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Form
                errorText={error}
                actions={
                  <Button variant="primary" formAction="submit" loading={busy} fullWidth>
                    Sign in
                  </Button>
                }
              >
                <SpaceBetween size="m">
                  <RadioGroup
                    value={kind}
                    onChange={({ detail }) => setKind(detail.value)}
                    items={[
                      { value: "root", label: "Root user", description: "Account owner that performs tasks requiring unrestricted access." },
                      { value: "iam", label: "IAM user", description: "User within an account that performs daily tasks." },
                    ]}
                  />
                  {kind === "iam" && (
                    <FormField label="Account ID (12 digits) or account alias">
                      <Input value={accountId} onChange={({ detail }) => setAccountId(detail.value)} />
                    </FormField>
                  )}
                  <FormField label={kind === "iam" ? "IAM user name" : "User name"}>
                    <Input value={username} autoComplete="username" onChange={({ detail }) => setUsername(detail.value)} />
                  </FormField>
                  <FormField label="Password">
                    <Input
                      type="password"
                      value={password}
                      autoComplete="current-password"
                      autoFocus
                      onChange={({ detail }) => setPassword(detail.value)}
                    />
                  </FormField>
                </SpaceBetween>
              </Form>
            </form>
          </Container>
          <Alert type="info" header="Demo credentials">
            Account ID <b>123456789012</b>, user name <b>admin</b>, password <b>admin123</b>.
            <br />
            Authentication is mocked — never enter real AWS credentials here.
          </Alert>
        </SpaceBetween>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
