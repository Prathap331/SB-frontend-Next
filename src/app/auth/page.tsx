export const dynamic = "force-dynamic";
import Header from '../../components/Header';
import AuthForm from '@/components/AuthForm';

export default function Auth() {
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />
      <div className="flex items-center justify-center px-4 sm:px-6 py-8 sm:py-14 md:py-16">
        <AuthForm />
      </div>
    </div>
  );
}
