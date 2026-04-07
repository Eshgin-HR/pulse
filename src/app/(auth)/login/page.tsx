'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl text-text-primary mb-2">PULSE</h1>
          <p className="text-sm text-text-secondary font-ui">
            Your weekly intelligence system
          </p>
          <p className="text-xs text-text-muted font-ui mt-1">PASHA Holding</p>
        </div>

        {sent ? (
          <div className="bg-primary-light rounded-lg p-6 text-center">
            <p className="text-base font-ui text-text-primary font-medium">
              Check your email
            </p>
            <p className="text-sm text-text-secondary font-ui mt-2">
              We sent a magic link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-xs text-danger font-ui">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
