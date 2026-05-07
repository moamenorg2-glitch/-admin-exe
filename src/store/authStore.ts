import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logAuditAction } from '../utils/auditLogger';

interface Profile {
  user_id: string;
  full_name: string;
  user_type: string;
  primary_phone: string;
  email: string | null;
  avatar_url: string | null;
  status: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  checkUser: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (profile: Profile) => void;
}

let checkUserPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  setProfile: (profile) => set({ profile }),

  checkUser: async () => {
    if (checkUserPromise) {
      return checkUserPromise;
    }

    checkUserPromise = (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Fetch profile to check if admin
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, user_type, primary_phone, email, avatar_url, status')
            .eq('user_id', session.user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error);
            set({ user: session.user, profile: null, isAdmin: false, isLoading: false });
            return;
          }

          const isAdmin = (profile as any)?.user_type === 'admin';
          set({ user: session.user, profile: profile as unknown as Profile, isAdmin, isLoading: false });
        } else {
          set({ user: null, profile: null, isAdmin: false, isLoading: false });
        }
      } catch (error) {
        console.error('Error checking user session:', error);
        set({ user: null, profile: null, isAdmin: false, isLoading: false });
      } finally {
        checkUserPromise = null;
      }
    })();

    return checkUserPromise;
  },

  signOut: async () => {
    try {
      const { user } = useAuthStore.getState();
      if (user) {
        await logAuditAction('LOGOUT', 'auth', user.id);
      }
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      set({ user: null, profile: null, isAdmin: false });
    }
  },
}));

// Set up auth listener
supabase.auth.onAuthStateChange((event, _session) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    useAuthStore.getState().checkUser().catch(err => {
      console.error('Auth check failed during state change:', err);
    });
  }
});
