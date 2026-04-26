import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, UserCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';

type RoleChoice = {
  key: 'admin' | 'official' | 'guest';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

const roleChoices: RoleChoice[] = [
  {
    key: 'admin',
    title: 'Admin',
    subtitle: 'System administration and workforce governance',
    icon: <Shield size={20} />,
  },
  {
    key: 'official',
    title: 'Official Rep',
    subtitle: 'Campaign operations, clock-ins, and field oversight',
    icon: <UserCheck size={20} />,
  },
  {
    key: 'guest',
    title: 'Guest',
    subtitle: 'Activation submissions and day-to-day field tasks',
    icon: <Users size={20} />,
  },
];

export default function RoleEntry() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg px-4 py-10 md:py-16 flex items-center justify-center transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bna-card p-8 md:p-10"
      >
        <div className="flex justify-center mb-6 md:mb-8">
          <img
            src="/BnA%20Logo.jpg"
            alt="B&A Logo"
            className="h-20 md:h-24 w-auto object-contain"
          />
        </div>

        <div className="text-center mb-8 md:mb-10">
          <p className="text-accent text-[11px] uppercase tracking-[0.25em] font-bold">BNA System Access</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight mt-2">Select Login Profile</h1>
          <p className="text-text-s text-xs md:text-sm mt-3">Choose how you are signing in before continuing to the secure login screen.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roleChoices.map((role, index) => (
            <motion.button
              key={role.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              onClick={() => navigate(`/login?role=${role.key}`)}
              className="text-left border border-border rounded-xl p-5 bg-bg/40 hover:bg-accent/10 hover:border-accent/40 transition-all"
            >
              <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-4">
                {role.icon}
              </div>
              <h2 className="text-lg font-bold uppercase tracking-tight">{role.title}</h2>
              <p className="text-text-s text-xs mt-2 leading-relaxed">{role.subtitle}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}