import { useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

interface UserProfileProps {
  userId: number;
  onClose?: () => void;
}

export function UserProfile({ userId, onClose }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
          throw new Error('Failed to load user');
        }
        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();

    return () => {
      setUser(null);
      setLoading(false);
    };
  }, [userId]);

  if (loading) {
    return <div role="status">Loading...</div>;
  }

  if (error) {
    return (
      <div role="alert" className="error-message">
        {error}
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="user-profile">
      {user.avatar && (
        <img src={user.avatar} alt={`${user.name}'s avatar`} width={64} height={64} />
      )}
      <h2 id="user-name">{user.name}</h2>
      <p id="user-email">{user.email}</p>
      {onClose && (
        <button onClick={onClose} aria-label="Close profile">
          Close
        </button>
      )}
    </div>
  );
}
