import { Footer, Header } from '../components/SiteChrome.jsx';

export default function SiteLayout({ children }) {
  return <><Header/>{children}<Footer/></>;
}
