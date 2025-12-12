export const dynamic = "force-dynamic";
import Header from '../../components/Header';
import AuthForm from '@/components/AuthForm';

export default function Auth() {
  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <Header />
      
      <div className="container mx-auto px-4 py-4">
        <div className="max-w-md mx-auto">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
