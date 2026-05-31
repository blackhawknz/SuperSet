import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
		void navigator.serviceWorker.register(serviceWorkerUrl);
	});
}

createRoot(document.getElementById('root')!).render(<App />);