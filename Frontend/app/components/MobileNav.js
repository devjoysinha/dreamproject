import Link from 'next/link';

const items = [
  ['browse', 'Browse', '/'],
  ['models', 'Models', '/models'],
  ['chat', 'Chat', '#chat'],
  ['account', 'Account', '#account'],
];

const paths = {
  browse: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z',
  models: 'M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z',
  chat: 'M5 5h14v11H9l-4 4V5Z',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.1 3.1-6 7-6s6.2 1.9 7 6',
};

function Icon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function MobileNav({ active }) {
  return <>
    <header className="mobile-header">
      <Link className="mobile-brand" href="/">
        <img src="/7035402.svg" alt="Leakporns logo" />
        <span>leak<b>porns</b></span>
      </Link>
      <Link className="mobile-header-link" href="/models">All Models</Link>
    </header>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {items.map(([name, label, href]) => <Link key={name} className={active === name ? 'active' : ''} href={href} aria-current={active === name ? 'page' : undefined}>
        <Icon name={name} />
        <span>{label}</span>
      </Link>)}
    </nav>
  </>;
}
