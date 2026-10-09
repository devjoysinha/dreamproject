import HumanVerification from './HumanVerification';

export const metadata = {
  title: 'Verify your browser',
  robots: { index: false, follow: false },
};

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
}

export default async function VerificationPage({ searchParams }) {
  const params = await searchParams;
  return <HumanVerification nextPath={safeNext(params?.next)} />;
}
