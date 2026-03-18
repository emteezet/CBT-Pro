/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy,
  OperationType, handleFirestoreError, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from './firebase';
import Papa from 'papaparse';
import { 
  LogOut, Plus, BookOpen, Clock, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Trash2, Edit3, Save, UserCircle, GraduationCap, LayoutDashboard, PlayCircle, Award, Upload, FileText, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface UserProfile {
  uid: string;
  email: string;
  role: 'teacher' | 'student';
  name: string;
}

interface Exam {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  teacherId: string;
  timeLimitMinutes: number;
  createdAt: any;
  isActive: boolean;
}

interface Question {
  id: string;
  examId: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  points: number;
}

interface Submission {
  id: string;
  examId: string;
  studentId: string;
  answers: number[];
  score: number;
  totalPoints: number;
  timestamp: any;
  completed: boolean;
}

// --- Components ---

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'exam' | 'results' | 'create-exam' | 'edit-questions' | 'student-results' | 'submission-detail' | 'teacher-exam-summary'>('dashboard');
  const [pendingView, setPendingView] = useState<any>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (view === 'exam') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [view]);

  const safeSetView = (newView: any) => {
    if (view === 'exam' && newView !== 'results' && newView !== 'exam') {
      setPendingView(newView);
      setShowExitConfirm(true);
    } else {
      setView(newView);
    }
  };

  const confirmExit = () => {
    if (pendingView) {
      setView(pendingView);
      setPendingView(null);
    }
    setShowExitConfirm(false);
  };

  const cancelExit = () => {
    setPendingView(null);
    setShowExitConfirm(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as UserProfile);
          } else {
            setProfile(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('dashboard');
      setSelectedExam(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSetRole = async (role: 'teacher' | 'student') => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      role,
      name: user.displayName || 'User'
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onGoogleLogin={handleLogin} />;
  }

  if (!profile) {
    return <RoleSelectionScreen onSelectRole={handleSetRole} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
        <Navbar profile={profile} onLogout={handleLogout} setView={safeSetView} />
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <Dashboard 
                profile={profile} 
                setView={safeSetView} 
                setSelectedExam={setSelectedExam} 
              />
            )}
            {view === 'create-exam' && (
              <ExamCreator 
                profile={profile} 
                onClose={() => safeSetView('dashboard')} 
              />
            )}
            {view === 'edit-questions' && selectedExam && (
              <QuestionEditor 
                exam={selectedExam} 
                onClose={() => safeSetView('dashboard')} 
              />
            )}
            {view === 'exam' && selectedExam && (
              <ExamSession 
                exam={selectedExam} 
                profile={profile} 
                onComplete={(submission) => {
                  setActiveSubmission(submission);
                  safeSetView('results');
                }}
              />
            )}
            {view === 'results' && activeSubmission && (
              <ResultsView 
                submission={activeSubmission} 
                onClose={() => {
                  safeSetView('dashboard');
                  setActiveSubmission(null);
                  setSelectedExam(null);
                }} 
              />
            )}
            {view === 'student-results' && (
              <StudentResultsDashboard 
                profile={profile} 
                onSelectSubmission={(s) => {
                  setSelectedSubmission(s);
                  safeSetView('submission-detail');
                }}
                onClose={() => safeSetView('dashboard')}
              />
            )}
            {view === 'submission-detail' && selectedSubmission && (
              <SubmissionDetailView 
                submission={selectedSubmission} 
                onClose={() => {
                  safeSetView('student-results');
                  setSelectedSubmission(null);
                }}
              />
            )}
            {view === 'teacher-exam-summary' && selectedExam && (
              <TeacherExamSummary 
                exam={selectedExam} 
                onClose={() => {
                  safeSetView('dashboard');
                  setSelectedExam(null);
                }} 
              />
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {showExitConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white max-w-md w-full rounded-[2.5rem] shadow-2xl p-10 text-center border border-stone-200"
              >
                <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-stone-900 mb-3">Exit Active Exam?</h3>
                <p className="text-stone-500 mb-8 leading-relaxed">
                  Your progress will not be saved. Are you sure you want to leave the exam session?
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={confirmExit}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg"
                  >
                    Yes, Exit Exam
                  </button>
                  <button 
                    onClick={cancelExit}
                    className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                  >
                    No, Stay in Exam
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-screens ---

const AuthScreen: React.FC<{ onGoogleLogin: () => void }> = ({ onGoogleLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-stone-200"
      >
        <div className="w-20 h-20 bg-stone-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
          <GraduationCap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-stone-900 mb-2 tracking-tight text-center">CBT Exam Pro</h1>
        <p className="text-stone-500 mb-8 font-medium text-center">
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
                placeholder="John Doe"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-stone-400 font-bold tracking-widest">Or continue with</span>
          </div>
        </div>
        
        <button 
          onClick={onGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-4 bg-white text-stone-900 border border-stone-200 rounded-2xl font-bold hover:bg-stone-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-sm mb-6"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Google Account
        </button>

        <div className="text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-bold text-stone-600 hover:text-stone-900 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
        
        <p className="mt-8 text-xs text-stone-400 uppercase tracking-widest font-bold text-center">Secure • Fast • Reliable</p>
      </motion.div>
    </div>
  );
};

const RoleSelectionScreen: React.FC<{ onSelectRole: (role: 'teacher' | 'student') => void }> = ({ onSelectRole }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] p-4">
    <div className="max-w-2xl w-full">
      <h2 className="text-3xl font-bold text-stone-900 mb-8 text-center tracking-tight italic font-serif">Choose your role to get started</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { role: 'teacher' as const, icon: BookOpen, title: 'I am a Teacher', desc: 'Create exams, manage questions, and track student progress.' },
          { role: 'student' as const, icon: UserCircle, title: 'I am a Student', desc: 'Take exams, view results, and improve your knowledge.' }
        ].map((item) => (
          <motion.button
            key={item.role}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelectRole(item.role)}
            className="bg-white p-8 rounded-3xl shadow-xl border border-stone-200 text-left hover:border-stone-900 transition-colors group"
          >
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 transition-colors">
              <item.icon className="w-7 h-7 text-stone-600 group-hover:text-white" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">{item.title}</h3>
            <p className="text-stone-500 leading-relaxed">{item.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  </div>
);

const Navbar: React.FC<{ profile: UserProfile, onLogout: () => void, setView: (v: any) => void }> = ({ profile, onLogout, setView }) => (
  <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
      <div 
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => setView('dashboard')}
      >
        <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">CBT Pro</span>
      </div>
      
      <div className="flex items-center gap-6">
        {profile.role === 'student' && (
          <button 
            onClick={() => setView('student-results')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-50 rounded-xl font-bold transition-all"
          >
            <Award className="w-5 h-5" />
            My Results
          </button>
        )}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-stone-50 rounded-full border border-stone-100">
          <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-stone-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none">{profile.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">{profile.role}</span>
          </div>
        </div>
        
        <button 
          onClick={onLogout}
          className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          title="Logout"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </div>
  </nav>
);

const Dashboard: React.FC<{ profile: UserProfile, setView: (v: any) => void, setSelectedExam: (e: Exam) => void }> = ({ profile, setView, setSelectedExam }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = profile.role === 'teacher' 
      ? query(collection(db, 'exams'), where('teacherId', '==', profile.uid), orderBy('createdAt', 'desc'))
      : query(collection(db, 'exams'), where('isActive', '==', true), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const examList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(examList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exams');
    });

    return unsubscribe;
  }, [profile]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            {profile.role === 'teacher' ? 'Teacher Dashboard' : 'Available Exams'}
          </h1>
          <p className="text-stone-500 font-medium">
            {profile.role === 'teacher' ? 'Manage your exams and questions' : 'Select an exam to start your assessment'}
          </p>
        </div>
        
        {profile.role === 'teacher' ? (
          <button 
            onClick={() => setView('create-exam')}
            className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg hover:shadow-stone-200"
          >
            <Plus className="w-5 h-5" />
            Create New Exam
          </button>
        ) : (
          <button 
            onClick={() => setView('student-results')}
            className="flex items-center gap-2 px-6 py-3 bg-white text-stone-900 border border-stone-200 rounded-2xl font-bold hover:bg-stone-50 transition-all shadow-sm"
          >
            <Award className="w-5 h-5" />
            View My Results
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-stone-100 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-stone-200">
          <BookOpen className="w-16 h-16 text-stone-200 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-stone-400">No exams found</h3>
          <p className="text-stone-400 mt-2">
            {profile.role === 'teacher' ? 'Start by creating your first exam' : 'Check back later for new exams'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <ExamCard 
              key={exam.id} 
              exam={exam} 
              profile={profile} 
              onEdit={() => { setSelectedExam(exam); setView('edit-questions'); }}
              onTake={() => { setSelectedExam(exam); setView('exam'); }}
              onSummary={() => { setSelectedExam(exam); setView('teacher-exam-summary'); }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

const ExamCard: React.FC<{ exam: Exam, profile: UserProfile, onEdit: () => void, onTake: () => void, onSummary: () => void }> = ({ exam, profile, onEdit, onTake, onSummary }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [stats, setStats] = useState<{ avg: number, max: number, count: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  useEffect(() => {
    if (profile.role === 'teacher') {
      const q = query(collection(db, 'submissions'), where('examId', '==', exam.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const submissions = snapshot.docs.map(doc => doc.data() as Submission);
        
        if (submissions.length > 0) {
          const totalScore = submissions.reduce((acc, curr) => acc + curr.score, 0);
          const maxScore = Math.max(...submissions.map(s => s.score));
          setStats({
            avg: Math.round((totalScore / submissions.length) * 10) / 10,
            max: maxScore,
            count: submissions.length
          });
        } else {
          setStats({ avg: 0, max: 0, count: 0 });
        }
        setLoadingStats(false);
      }, (error) => {
        console.error("Error fetching stats:", error);
        setLoadingStats(false);
      });
      return unsubscribe;
    }
  }, [exam.id, profile.role]);

  const toggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'exams', exam.id), { isActive: !exam.isActive });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exams/${exam.id}`);
    }
  };

  const deleteExam = async () => {
    try {
      await deleteDoc(doc(db, 'exams', exam.id));
      setShowDeleteConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exams/${exam.id}`);
    }
  };

  return (
    <>
      <motion.div 
        whileHover={{ y: -5 }}
        className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden flex flex-col group hover:shadow-xl transition-all"
      >
        <div className="p-8 flex-grow">
          <div className="flex justify-between items-start mb-6">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${exam.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-stone-100 text-stone-400 border border-stone-200'}`}>
              {exam.isActive ? 'Active' : 'Draft'}
            </div>
            <div className="flex items-center gap-2 text-stone-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              {exam.timeLimitMinutes}m
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-stone-900 mb-3 leading-tight group-hover:text-stone-700 transition-colors">{exam.title}</h3>
          <p className="text-stone-500 line-clamp-2 text-sm leading-relaxed mb-6">{exam.description || 'No description provided.'}</p>

          {profile.role === 'teacher' && stats && (
            <div className="grid grid-cols-3 gap-2 p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="text-center">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Avg Score</p>
                <p className="text-lg font-bold text-stone-900">{stats.avg}</p>
              </div>
              <div className="text-center border-x border-stone-200">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Highest</p>
                <p className="text-lg font-bold text-stone-900">{stats.max}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Students</p>
                <p className="text-lg font-bold text-stone-900">{stats.count}</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="px-8 py-6 bg-stone-50 border-t border-stone-100 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          {profile.role === 'teacher' ? (
            <>
              <div className="flex gap-2 items-center">
                <button onClick={onEdit} className="p-2 text-stone-600 hover:bg-white rounded-lg transition-colors" title="Edit Questions"><Edit3 className="w-5 h-5" /></button>
                <button onClick={toggleActive} className={`p-2 rounded-lg transition-colors ${exam.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={exam.isActive ? 'Deactivate' : 'Activate'}>
                  {exam.isActive ? <PlayCircle className="w-5 h-5 rotate-90" /> : <PlayCircle className="w-5 h-5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-5 h-5" /></button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onSummary(); }} 
                  className="p-2 text-stone-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors" 
                  title="View Summary"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </button>
              </div>
              <button onClick={onEdit} className="text-sm font-bold text-stone-900 flex items-center justify-center sm:justify-start gap-1 hover:gap-2 transition-all bg-white sm:bg-transparent py-2 sm:py-0 rounded-xl border border-stone-200 sm:border-transparent">
                Manage <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button 
              onClick={onTake}
              className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
            >
              Start Exam <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white max-w-md w-full rounded-[2.5rem] shadow-2xl p-10 text-center border border-stone-200"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-3">Delete Exam?</h3>
              <p className="text-stone-500 mb-8 leading-relaxed">
                Are you sure you want to delete "{exam.title}"? This action cannot be undone and all questions will be lost.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={deleteExam}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg"
                >
                  Yes, Delete Exam
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

const ExamCreator: React.FC<{ profile: UserProfile, onClose: () => void }> = ({ profile, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'exams'), {
        title,
        description,
        instructions,
        teacherId: profile.uid,
        timeLimitMinutes: Number(timeLimit),
        createdAt: new Date(),
        isActive: false
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'exams');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden"
    >
      <div className="p-10">
        <h2 className="text-3xl font-bold mb-8 tracking-tight">Create New Exam</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Exam Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
              placeholder="e.g. Mathematics Mid-term 2024"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Description (Optional)</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium h-32 resize-none"
              placeholder="Provide some context for the students..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Custom Instructions (Optional)</label>
            <textarea 
              value={instructions} 
              onChange={e => setInstructions(e.target.value)}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium h-32 resize-none"
              placeholder="Add instructions for students (e.g. No calculators allowed, read carefully...)"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Time Limit (Minutes)</label>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                value={timeLimit} 
                onChange={e => setTimeLimit(Number(e.target.value))}
                className="w-32 px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
                min="1"
                required
              />
              <span className="text-stone-500 font-medium">minutes</span>
            </div>
          </div>
          
          <div className="flex gap-4 pt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Exam'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

interface BulkUploadError {
  row: number;
  message: string;
}

const QuestionEditor: React.FC<{ exam: Exam, onClose: () => void }> = ({ exam, onClose }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadErrors, setBulkUploadErrors] = useState<BulkUploadError[]>([]);
  const [bulkUploadSuccess, setBulkUploadSuccess] = useState<number | null>(null);
  const [isEditingExam, setIsEditingExam] = useState(false);
  const [examTitle, setExamTitle] = useState(exam.title);
  const [examDesc, setExamDesc] = useState(exam.description);
  const [examInstr, setExamInstr] = useState(exam.instructions || '');
  const [examTime, setExamTime] = useState(exam.timeLimitMinutes);
  const [savingExam, setSavingExam] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'exams', exam.id, 'questions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions(qList);
      setLoading(false);
    });
    return unsubscribe;
  }, [exam.id]);

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion?.text || !editingQuestion.options || editingQuestion.correctAnswerIndex === undefined) return;
    
    try {
      if (editingQuestion.id) {
        const { id, ...data } = editingQuestion;
        await updateDoc(doc(db, 'exams', exam.id, 'questions', id!), data);
      } else {
        await addDoc(collection(db, 'exams', exam.id, 'questions'), {
          examId: exam.id,
          text: editingQuestion.text,
          options: editingQuestion.options,
          correctAnswerIndex: editingQuestion.correctAnswerIndex,
          points: editingQuestion.points || 1
        });
      }
      setEditingQuestion(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `exams/${exam.id}/questions`);
    }
  };

  const deleteQuestion = async () => {
    if (!deletingQuestionId) return;
    try {
      await deleteDoc(doc(db, 'exams', exam.id, 'questions', deletingQuestionId));
      setDeletingQuestionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exams/${exam.id}/questions/${deletingQuestionId}`);
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExam(true);
    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        title: examTitle,
        description: examDesc,
        instructions: examInstr,
        timeLimitMinutes: Number(examTime)
      });
      setIsEditingExam(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exams/${exam.id}`);
    } finally {
      setSavingExam(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkUploadErrors([]);
    setBulkUploadSuccess(null);
    setIsBulkUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const questionsToUpload: any[] = [];
        const errors: BulkUploadError[] = [];

        results.data.forEach((row: any, index) => {
          const rowNum = index + 1;
          const text = row.text?.trim();
          const options = [
            row.optionA?.trim(),
            row.optionB?.trim(),
            row.optionC?.trim(),
            row.optionD?.trim()
          ].filter(Boolean);
          const correctAnswerIndex = parseInt(row.correctAnswerIndex);
          const points = parseInt(row.points) || 1;

          if (!text) {
            errors.push({ row: rowNum, message: 'Missing question text' });
          }
          if (options.length < 2) {
            errors.push({ row: rowNum, message: `At least 2 options are required (found ${options.length})` });
          }
          if (isNaN(correctAnswerIndex)) {
            errors.push({ row: rowNum, message: 'Correct answer index must be a number' });
          } else if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
            errors.push({ row: rowNum, message: `Invalid correct answer index ${correctAnswerIndex} (must be between 0 and ${options.length - 1})` });
          }

          if (errors.filter(e => e.row === rowNum).length === 0) {
            questionsToUpload.push({
              examId: exam.id,
              text,
              options,
              correctAnswerIndex,
              points
            });
          }
        });

        if (errors.length > 0) {
          setBulkUploadErrors(errors);
          setIsBulkUploading(false);
          return;
        }

        try {
          let count = 0;
          for (const q of questionsToUpload) {
            await addDoc(collection(db, 'exams', exam.id, 'questions'), q);
            count++;
          }
          setBulkUploadSuccess(count);
        } catch (error) {
          setBulkUploadErrors([{ row: 0, message: 'Failed to upload questions to database. Please check your connection.' }]);
          console.error(error);
        } finally {
          setIsBulkUploading(false);
          e.target.value = '';
        }
      },
      error: (error) => {
        setBulkUploadErrors([{ row: 0, message: `CSV Parsing Error: ${error.message}` }]);
        setIsBulkUploading(false);
      }
    });
  };

  const downloadTemplate = () => {
    const csvContent = "text,optionA,optionB,optionC,optionD,correctAnswerIndex,points\nWhat is 2+2?,3,4,5,6,1,1\nWhich planet is known as the Red Planet?,Mars,Venus,Jupiter,Saturn,0,1";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "exam_questions_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-stone-200 transition-all flex-shrink-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Question Editor</h2>
            <p className="text-stone-500 font-medium text-sm sm:text-base">Manage questions for "{exam.title}"</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => setIsEditingExam(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-stone-900 border border-stone-200 rounded-2xl font-bold hover:bg-stone-50 transition-all shadow-sm"
          >
            <Edit3 className="w-5 h-5" />
            Edit Exam Details
          </button>
          <div className="relative w-full sm:w-auto">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCsvUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isBulkUploading}
            />
            <button className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-stone-900 border border-stone-200 rounded-2xl font-bold hover:bg-stone-50 transition-all shadow-sm ${isBulkUploading ? 'opacity-50' : ''}`}>
              <Upload className="w-5 h-5" />
              {isBulkUploading ? 'Uploading...' : 'Bulk Upload (CSV)'}
            </button>
          </div>
          <button 
            onClick={() => setEditingQuestion({ text: '', options: ['', '', '', ''], correctAnswerIndex: 0, points: 1 })}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Question
          </button>
        </div>
      </div>

      {bulkUploadErrors.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div className="flex-grow">
            <h4 className="text-red-900 font-bold mb-3">Bulk Upload Failed</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {bulkUploadErrors.map((err, i) => (
                <div key={i} className="flex gap-3 text-sm font-medium">
                  {err.row > 0 && (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-lg text-[10px] font-bold h-fit mt-0.5">
                      ROW {err.row}
                    </span>
                  )}
                  <span className="text-red-700">{err.message}</span>
                </div>
              ))}
            </div>
            <button onClick={downloadTemplate} className="mt-6 text-red-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:underline">
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>
          <button onClick={() => setBulkUploadErrors([])} className="text-red-400 hover:text-red-600"><Plus className="w-5 h-5 rotate-45" /></button>
        </div>
      )}

      {bulkUploadSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
          <div className="flex-grow">
            <h4 className="text-emerald-900 font-bold mb-1">Bulk Upload Successful</h4>
            <p className="text-emerald-700 text-sm font-medium">Successfully uploaded {bulkUploadSuccess} questions to the exam.</p>
          </div>
          <button onClick={() => setBulkUploadSuccess(null)} className="text-emerald-400 hover:text-emerald-600"><Plus className="w-5 h-5 rotate-45" /></button>
        </div>
      )}

      <AnimatePresence>
        {isEditingExam && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white max-w-2xl w-full rounded-[2.5rem] shadow-2xl p-10 border border-stone-200 overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-2xl font-bold text-stone-900 mb-8">Edit Exam Details</h3>
              <form onSubmit={handleSaveExam} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Exam Title</label>
                  <input 
                    type="text" 
                    value={examTitle} 
                    onChange={e => setExamTitle(e.target.value)}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Description</label>
                  <textarea 
                    value={examDesc} 
                    onChange={e => setExamDesc(e.target.value)}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium h-24 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Instructions</label>
                  <textarea 
                    value={examInstr} 
                    onChange={e => setExamInstr(e.target.value)}
                    className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium h-32 resize-none"
                    placeholder="Add instructions for students..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Time Limit (Minutes)</label>
                  <input 
                    type="number" 
                    value={examTime} 
                    onChange={e => setExamTime(Number(e.target.value))}
                    className="w-32 px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium"
                    min="1"
                    required
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsEditingExam(false)}
                    className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={savingExam}
                    className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50"
                  >
                    {savingExam ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="h-40 bg-stone-100 rounded-3xl animate-pulse"></div>)}
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-stone-200">
              <p className="text-stone-400 font-bold">No questions added yet.</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 group relative">
                <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingQuestion(q)} className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-lg"><Edit3 className="w-5 h-5" /></button>
                  <button onClick={() => setDeletingQuestionId(q.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                </div>
                <div className="flex gap-4">
                  <span className="text-4xl font-serif italic text-stone-100 font-bold">{idx + 1}</span>
                  <div className="flex-grow">
                    <p className="text-lg font-bold text-stone-900 mb-6 pr-16">{q.text}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`px-4 py-3 rounded-xl text-sm font-medium border ${i === q.correctAnswerIndex ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-100 text-stone-600'}`}>
                          <span className="inline-block w-6 h-6 rounded-lg bg-white border border-inherit flex items-center justify-center mr-3 text-[10px] font-bold uppercase">
                            {String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                          {i === q.correctAnswerIndex && <CheckCircle2 className="w-4 h-4 inline-block ml-2" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-28 bg-stone-900 text-white p-8 rounded-3xl shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Exam Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-stone-400 font-medium">Total Questions</span>
                <span className="text-2xl font-bold">{questions.length}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-stone-400 font-medium">Total Points</span>
                <span className="text-2xl font-bold">{questions.reduce((acc, q) => acc + q.points, 0)}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-stone-400 font-medium">Time Limit</span>
                <span className="text-2xl font-bold">{exam.timeLimitMinutes}m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingQuestion && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-bold mb-8">{editingQuestion.id ? 'Edit Question' : 'New Question'}</h3>
                <form onSubmit={handleSaveQuestion} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Question Text</label>
                    <textarea 
                      value={editingQuestion.text} 
                      onChange={e => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all font-medium h-24 resize-none"
                      placeholder="Enter your question here..."
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editingQuestion.options?.map((opt, i) => (
                      <div key={i}>
                        <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2 flex justify-between">
                          Option {String.fromCharCode(65 + i)}
                          <input 
                            type="radio" 
                            name="correct" 
                            checked={editingQuestion.correctAnswerIndex === i}
                            onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswerIndex: i })}
                            className="w-4 h-4 accent-stone-900"
                          />
                        </label>
                        <input 
                          type="text" 
                          value={opt} 
                          onChange={e => {
                            const newOpts = [...(editingQuestion.options || [])];
                            newOpts[i] = e.target.value;
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className={`w-full px-4 py-3 rounded-xl border transition-all font-medium ${editingQuestion.correctAnswerIndex === i ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}
                          placeholder={`Option ${i + 1}`}
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Points:</label>
                      <input 
                        type="number" 
                        value={editingQuestion.points} 
                        onChange={e => setEditingQuestion({ ...editingQuestion, points: Number(e.target.value) })}
                        className="w-20 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                        min="1"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setEditingQuestion(null)} className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all">Cancel</button>
                      <button type="submit" className="px-8 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save Question
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {deletingQuestionId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-10 text-center border border-stone-200"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-3">Delete Question?</h3>
              <p className="text-stone-500 mb-8 leading-relaxed">
                Are you sure you want to delete this question? This action cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={deleteQuestion}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg"
                >
                  Yes, Delete Question
                </button>
                <button 
                  onClick={() => setDeletingQuestionId(null)}
                  className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ExamSession: React.FC<{ exam: Exam, profile: UserProfile, onComplete: (s: Submission) => void }> = ({ exam, profile, onComplete }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(exam.timeLimitMinutes * 60);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(!!exam.instructions);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const q = query(collection(db, 'exams', exam.id, 'questions'));
        const snapshot = await getDocs(q);
        const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setQuestions(qList);
        setAnswers(new Array(qList.length).fill(-1));
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `exams/${exam.id}/questions`);
      }
    };
    fetchQuestions();
  }, [exam.id]);

  useEffect(() => {
    if (loading || timeLeft <= 0 || showInstructions) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, timeLeft, showInstructions]);

  const handleAnswer = (optionIdx: number) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentIndex] = optionIdx;
      return newAnswers;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || submitting) return;

      // Instructions Screen Shortcut
      if (showInstructions) {
        if (e.key === 'Enter') {
          setShowInstructions(false);
        }
        return;
      }

      // Submit Confirmation Modal Shortcuts
      if (showSubmitConfirm) {
        if (e.key === 'Enter') {
          setShowSubmitConfirm(false);
          handleSubmit();
        } else if (e.key === 'Escape') {
          setShowSubmitConfirm(false);
        }
        return;
      }

      // Navigation
      if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }

      // Answer Selection (A, B, C, D)
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        const index = key.charCodeAt(0) - 65;
        if (questions[currentIndex] && index < questions[currentIndex].options.length) {
          handleAnswer(index);
        }
      }
      
      // Answer Selection (1, 2, 3, 4)
      if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key) - 1;
        if (questions[currentIndex] && index < questions[currentIndex].options.length) {
          handleAnswer(index);
        }
      }

      // Submit / Next
      if (e.key === 'Enter') {
        if (currentIndex === questions.length - 1) {
          setShowSubmitConfirm(true);
        } else {
          setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, showInstructions, submitting, showSubmitConfirm, questions, currentIndex]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    
    let score = 0;
    let totalPoints = 0;
    questions.forEach((q, i) => {
      totalPoints += q.points;
      if (answers[i] === q.correctAnswerIndex) {
        score += q.points;
      }
    });

    const submission: Omit<Submission, 'id'> = {
      examId: exam.id,
      studentId: profile.uid,
      answers,
      score,
      totalPoints,
      timestamp: new Date(),
      completed: true
    };

    try {
      const docRef = await addDoc(collection(db, 'submissions'), submission);
      onComplete({ id: docRef.id, ...submission });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div></div>;

  if (showInstructions) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-2xl p-10 border border-stone-200"
      >
        <div className="w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center mb-8 shadow-lg">
          <AlertCircle className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-stone-900 mb-4 tracking-tight">Exam Instructions</h2>
        <p className="text-stone-500 mb-8 text-lg leading-relaxed">
          Please read the following instructions carefully before starting the exam.
        </p>
        
        <div className="bg-stone-50 rounded-3xl p-8 mb-10 border border-stone-100">
          <div className="prose prose-stone max-w-none">
            <p className="text-stone-700 whitespace-pre-wrap leading-relaxed italic">
              {exam.instructions}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-stone-400 text-sm font-bold uppercase tracking-widest px-2">
            <Clock className="w-4 h-4" />
            Time Limit: {exam.timeLimitMinutes} minutes
          </div>
          <button 
            onClick={() => setShowInstructions(false)}
            className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl flex items-center justify-center gap-3"
          >
            I Understand, Start Exam <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-mono">ENTER</span> <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = answers.filter(a => a !== -1).length;
  const remainingCount = questions.length - answeredCount;
  const progressPercentage = (answeredCount / questions.length) * 100;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{exam.title}</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
              <p className="text-stone-500 font-medium whitespace-nowrap">Question {currentIndex + 1} of {questions.length}</p>
              <div className="hidden sm:block h-4 w-px bg-stone-200" />
              <div className="flex flex-wrap gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {answeredCount} Answered
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {remainingCount} Remaining
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border-2 font-mono text-xl font-bold w-full md:w-auto justify-center ${timeLeft < 60 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-white border-stone-200 text-stone-900'}`}>
          <Clock className="w-6 h-6" />
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden">
        <div className="h-3 bg-stone-100 relative">
          {/* Current Question Indicator */}
          <motion.div 
            className="absolute top-0 left-0 h-full bg-stone-200/50"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
          {/* Answered Progress Bar */}
          <motion.div 
            className="absolute top-0 left-0 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] z-10"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ type: 'spring', stiffness: 50, damping: 15 }}
          />
        </div>
        
        <div className="p-6 sm:p-10 md:p-16">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-stone-900 mb-8 sm:mb-12 leading-tight">
            {currentQuestion.text}
          </h3>
          
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {currentQuestion.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 text-left transition-all transform active:scale-[0.98] ${answers[currentIndex] === i ? 'bg-stone-900 border-stone-900 text-white shadow-xl' : 'bg-stone-50 border-stone-100 text-stone-600 hover:border-stone-300'}`}
              >
                <span className={`w-8 h-8 sm:w-10 h-10 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-base sm:text-lg flex-shrink-0 ${answers[currentIndex] === i ? 'bg-white/20' : 'bg-white border border-stone-200'}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-base sm:text-lg font-medium">{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 sm:px-10 md:px-16 pb-8 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">
          <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
            <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm">←</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm">→</span>
            Navigate
          </div>
          <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
            <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm">A</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm">B</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm">C</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm">D</span>
            Select
          </div>
          <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
            <span className="bg-white px-1.5 py-0.5 rounded border border-stone-200 shadow-sm text-[8px]">Enter</span>
            {currentIndex === questions.length - 1 ? 'Finish' : 'Next'}
          </div>
        </div>
        
        <div className="px-4 sm:px-10 py-6 sm:py-8 bg-stone-50 border-t border-stone-100 flex justify-between items-center gap-2">
          <button 
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-stone-600 font-bold disabled:opacity-30 hover:bg-white rounded-xl transition-all text-sm sm:text-base"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 h-5" /> Previous
          </button>
          
          {currentIndex === questions.length - 1 ? (
            <button 
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submitting}
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-10 py-3 sm:py-4 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-100 disabled:opacity-50 text-sm sm:text-base whitespace-nowrap"
            >
              {submitting ? 'Submitting...' : 'Finish & Submit'}
            </button>
          ) : (
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              className="flex items-center gap-1 sm:gap-2 px-4 sm:px-10 py-3 sm:py-4 bg-stone-900 text-white rounded-xl sm:rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg text-sm sm:text-base whitespace-nowrap"
            >
              Next <span className="hidden sm:inline">Question</span> <ChevronRight className="w-4 h-4 sm:w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white max-w-md w-full rounded-[2.5rem] shadow-2xl p-10 text-center border border-stone-200"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-3">Submit Exam?</h3>
              <p className="text-stone-500 mb-8 leading-relaxed">
                You have answered {answers.filter(a => a !== -1).length} out of {questions.length} questions. Are you ready to submit your exam?
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setShowSubmitConfirm(false); handleSubmit(); }}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  Yes, Submit Now <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-mono">ENTER</span>
                </button>
                <button 
                  onClick={() => setShowSubmitConfirm(false)}
                  className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                >
                  No, Keep Reviewing <span className="bg-stone-900/10 px-2 py-0.5 rounded text-[10px] font-mono">ESC</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-10 h-10 rounded-xl font-bold text-xs transition-all ${currentIndex === i ? 'bg-stone-900 text-white scale-110 shadow-lg' : answers[i] !== -1 ? 'bg-stone-200 text-stone-600' : 'bg-white text-stone-400 border border-stone-200'}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

const TeacherExamSummary: React.FC<{ exam: Exam, onClose: () => void }> = ({ exam, onClose }) => {
  const [submissions, setSubmissions] = useState<(Submission & { studentName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ avg: number, max: number, count: number } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'submissions'), where('examId', '==', exam.id), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const subList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      
      const studentIds = Array.from(new Set(subList.map(s => s.studentId)));
      const studentNames: Record<string, string> = {};
      
      if (studentIds.length > 0) {
        for (const id of studentIds) {
          try {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
              studentNames[id] = userDoc.data().name;
            }
          } catch (e) {
            console.error("Error fetching student name:", e);
          }
        }
      }

      const enrichedSubmissions = subList.map(s => ({
        ...s,
        studentName: studentNames[s.studentId] || 'Unknown Student'
      }));

      setSubmissions(enrichedSubmissions);
      
      if (subList.length > 0) {
        const totalScore = subList.reduce((acc, curr) => acc + curr.score, 0);
        const maxScore = Math.max(...subList.map(s => s.score));
        setStats({
          avg: Math.round((totalScore / subList.length) * 10) / 10,
          max: maxScore,
          count: subList.length
        });
      } else {
        setStats({ avg: 0, max: 0, count: 0 });
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [exam.id]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{exam.title}</h2>
            <p className="text-stone-500 font-medium">Performance Summary</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-200 text-center">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Average Score</p>
              <p className="text-4xl font-black text-stone-900">{stats?.avg}</p>
            </div>
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-200 text-center">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Highest Score</p>
              <p className="text-4xl font-black text-emerald-600">{stats?.max}</p>
            </div>
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-200 text-center">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Total Students</p>
              <p className="text-4xl font-black text-stone-900">{stats?.count}</p>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-stone-200 overflow-hidden">
            <div className="px-10 py-8 border-b border-stone-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Student Results</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{submissions.length} Submissions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50">
                    <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Student Name</th>
                    <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Score</th>
                    <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Percentage</th>
                    <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-10 py-20 text-center text-stone-400 font-medium italic">No submissions yet for this exam.</td>
                    </tr>
                  ) : (
                    submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-10 py-6 font-bold text-stone-900">{sub.studentName}</td>
                        <td className="px-10 py-6 font-mono font-bold text-stone-600">{sub.score} / {sub.totalPoints}</td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-grow h-2 bg-stone-100 rounded-full overflow-hidden max-w-[100px]">
                              <div 
                                className="h-full bg-emerald-500" 
                                style={{ width: `${(sub.score / sub.totalPoints) * 100}%` }}
                              />
                            </div>
                            <span className="font-bold text-stone-900">{Math.round((sub.score / sub.totalPoints) * 100)}%</span>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-stone-400 text-sm font-medium">
                          {sub.timestamp?.toDate ? sub.timestamp.toDate().toLocaleDateString() : new Date(sub.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

const ResultsView: React.FC<{ submission: Submission, onClose: () => void }> = ({ submission, onClose }) => {
  const percentage = Math.round((submission.score / submission.totalPoints) * 100);
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-white rounded-[3rem] shadow-2xl border border-stone-200 overflow-hidden text-center"
    >
      <div className="p-16">
        <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Award className="w-12 h-12 text-emerald-600" />
        </div>
        
        <h2 className="text-4xl font-bold text-stone-900 mb-2 tracking-tight">Exam Completed!</h2>
        <p className="text-stone-500 font-medium mb-12">Your results have been recorded successfully.</p>
        
        <div className="relative w-48 h-48 mx-auto mb-12">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-stone-100" />
            <motion.circle 
              cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" 
              strokeDasharray={552.92}
              initial={{ strokeDashoffset: 552.92 }}
              animate={{ strokeDashoffset: 552.92 - (552.92 * percentage) / 100 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="text-emerald-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-stone-900">{percentage}%</span>
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Score</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
            <span className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Points</span>
            <span className="text-2xl font-bold text-stone-900">{submission.score} / {submission.totalPoints}</span>
          </div>
          <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
            <span className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Status</span>
            <span className="text-2xl font-bold text-emerald-600">Passed</span>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="w-full py-5 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl"
        >
          Return to Dashboard
        </button>
      </div>
    </motion.div>
  );
};

const StudentResultsDashboard: React.FC<{ profile: UserProfile, onSelectSubmission: (s: Submission) => void, onClose: () => void }> = ({ profile, onSelectSubmission, onClose }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Record<string, Exam>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'submissions'), where('studentId', '==', profile.uid), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const subList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      setSubmissions(subList);
      
      // Fetch exam titles for these submissions
      const examIds = Array.from(new Set(subList.map(s => s.examId)));
      const examMap: Record<string, Exam> = { ...exams };
      
      for (const id of examIds) {
        if (!examMap[id]) {
          try {
            const examDoc = await getDoc(doc(db, 'exams', id));
            if (examDoc.exists()) {
              examMap[id] = { id: examDoc.id, ...examDoc.data() } as Exam;
            }
          } catch (error) {
            console.error(`Failed to fetch exam ${id}:`, error);
          }
        }
      }
      setExams(examMap);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });

    return unsubscribe;
  }, [profile.uid]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-stone-200 transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">My Exam Results</h1>
          <p className="text-stone-500 font-medium">Track your performance across all assessments</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-stone-100 rounded-3xl animate-pulse"></div>)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-stone-200">
          <Award className="w-16 h-16 text-stone-200 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-stone-400">No results yet</h3>
          <p className="text-stone-400 mt-2">Complete an exam to see your results here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {submissions.map((sub) => {
            const exam = exams[sub.examId];
            const percentage = Math.round((sub.score / sub.totalPoints) * 100);
            return (
              <motion.button
                key={sub.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectSubmission(sub)}
                className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 flex items-center justify-between hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl ${percentage >= 70 ? 'bg-emerald-50 text-emerald-600' : percentage >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                    {percentage}%
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{exam?.title || 'Loading Exam...'}</h3>
                    <p className="text-stone-500 text-sm font-medium">
                      {sub.timestamp?.toDate ? sub.timestamp.toDate().toLocaleDateString() : 'Unknown Date'} • {sub.score} / {sub.totalPoints} Points
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${percentage >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {percentage >= 70 ? 'Excellent' : percentage >= 40 ? 'Passed' : 'Failed'}
                  </div>
                  <ChevronRight className="w-6 h-6 text-stone-300" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const SubmissionDetailView: React.FC<{ submission: Submission, onClose: () => void }> = ({ submission, onClose }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const examDoc = await getDoc(doc(db, 'exams', submission.examId));
        if (examDoc.exists()) {
          setExam({ id: examDoc.id, ...examDoc.data() } as Exam);
        }
        
        const qSnapshot = await getDocs(query(collection(db, 'exams', submission.examId, 'questions')));
        const qList = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setQuestions(qList);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch details:', error);
      }
    };
    fetchData();
  }, [submission.examId]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div></div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-stone-200 transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{exam?.title} - Review</h2>
            <p className="text-stone-500 font-medium">Review your answers and correct solutions</p>
          </div>
        </div>
        <div className="bg-stone-900 text-white px-8 py-4 rounded-3xl shadow-xl flex items-center gap-6">
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold">Score</span>
            <span className="text-2xl font-bold">{submission.score} / {submission.totalPoints}</span>
          </div>
          <div className="w-px h-10 bg-white/10"></div>
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold">Percentage</span>
            <span className="text-2xl font-bold">{Math.round((submission.score / submission.totalPoints) * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => {
          const studentAnswerIdx = submission.answers[idx];
          const isCorrect = studentAnswerIdx === q.correctAnswerIndex;
          
          return (
            <div key={q.id} className={`bg-white p-8 rounded-[2rem] shadow-sm border-2 transition-all ${isCorrect ? 'border-emerald-100' : 'border-red-100'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-serif italic text-stone-200 font-bold">{idx + 1}</span>
                  <p className="text-xl font-bold text-stone-900 leading-tight">{q.text}</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {isCorrect ? 'Correct' : 'Incorrect'}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt, i) => {
                  const isStudentChoice = studentAnswerIdx === i;
                  const isCorrectChoice = q.correctAnswerIndex === i;
                  
                  let bgClass = 'bg-stone-50 border-stone-100 text-stone-600';
                  if (isCorrectChoice) bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20';
                  if (isStudentChoice && !isCorrectChoice) bgClass = 'bg-red-50 border-red-200 text-red-700';

                  return (
                    <div key={i} className={`px-6 py-4 rounded-2xl border-2 text-sm font-bold flex items-center justify-between ${bgClass}`}>
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${isCorrectChoice ? 'bg-white border-emerald-300' : isStudentChoice ? 'bg-white border-red-300' : 'bg-white border-stone-200'}`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                      {isCorrectChoice && <CheckCircle2 className="w-5 h-5" />}
                      {isStudentChoice && !isCorrectChoice && <AlertCircle className="w-5 h-5" />}
                    </div>
                  );
                })}
              </div>
              
              {!isCorrect && studentAnswerIdx !== -1 && (
                <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3 text-amber-700 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>You selected <strong>{String.fromCharCode(65 + studentAnswerIdx)}</strong>. The correct answer is <strong>{String.fromCharCode(65 + q.correctAnswerIndex)}</strong>.</span>
                </div>
              )}
              {studentAnswerIdx === -1 && (
                <div className="mt-6 p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-3 text-stone-500 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>You did not answer this question. The correct answer is <strong>{String.fromCharCode(65 + q.correctAnswerIndex)}</strong>.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-center pt-8">
        <button 
          onClick={onClose}
          className="px-12 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl"
        >
          Back to Results
        </button>
      </div>
    </motion.div>
  );
};
