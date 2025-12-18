import { useEffect, useState } from 'react';
import './App.css';
import { Logo } from './components/logo';

const colorProfile = {
  default: {
    background: 'linear-gradient(135deg, #f6f7f9 0%, #e2e4ea 100%)', // Subtle gray
    cardBorderColor: '#e2e4ea', // Light gray border
    textPrimaryColor: '#222', // Primary text dark gray
    textDescColor: '#666', // Description text medium gray
    textFooterColor: '#aaa', // Footer text light gray
  },
  success: {
    background: 'linear-gradient(135deg, #f3fcf7 0%, #b7eacb 100%)', // Subtle green
    cardBorderColor: '#b7eacb', // Green border
    textPrimaryColor: '#217a4a', // Primary text dark green
    textDescColor: '#4ca96b', // Description text medium green
    textFooterColor: '#7fd6a3', // Footer text light green
  },
  error: {
    background: 'linear-gradient(135deg, #fdf7f7 0%, #f7d4d4 100%)', // Subtle light red
    cardBorderColor: '#f7d4d4', // Red border
    textPrimaryColor: '#a94442', // Primary text dark red
    textDescColor: '#d9534f', // Description text medium red
    textFooterColor: '#f7bcbc', // Footer text light red
  },
  requesting: {
    background: 'linear-gradient(135deg, #fafaf5 0%, #f5e9be 100%)', // Subtle yellow
    cardBorderColor: '#f5e9be', // Yellow border
    textPrimaryColor: '#8a6d3b', // Primary text dark yellow
    textDescColor: '#c7a94a', // Description text medium yellow
    textFooterColor: '#f5e9be', // Footer text light yellow
  },
}

type Status = 'default' | 'success' | 'error' | 'requesting';

function App() {
  const [title, setTitle] = useState('OAuth Login');
  const [desc, setDesc] = useState('Initial screen, you can close this');
  const [footer, setFooter] = useState('');
  const [status, setStatus] = useState<Status>('default');
  // const [status, setStatus] = useState<Status>('success');
  // const [status, setStatus] = useState<Status>('error');
  // const [status, setStatus] = useState<Status>('requesting');

  // get the full url
  const urlParams = new URLSearchParams(window.location.hash.slice(1));
  const access_token = urlParams.get('access_token');
  const state = urlParams.get('state');
  const currentTime = new Date().toLocaleString();
  useEffect(() => {
    if (access_token && state) {
      setStatus('requesting');
      setTitle('Logging in...');
      setDesc('Please do not close this page');
      setFooter(currentTime);
      fetch(`/oauth2/callback?access_token=${access_token}&state=${state}`)
        .then(res => {
          return res.json();
        })
        .then(data => {
          if (data.ok) {
            setStatus('success');
            setTitle('Login Success');
            setDesc('Please close this page');
            setFooter('');
          } else {
            setStatus('error');
            setTitle('Login Failed');
            setDesc('Please try again');
            setFooter(data.error);
          }
        })
        .catch(err => {
          console.error(err);
          setStatus('error');
          setTitle('Login Failed');
          setDesc('Please try again');
          setFooter(err.message);
        });
    } else {
      setStatus('default'); // DEBUG POINT
      setTitle('What are you doing? 👊');
      setDesc('please do not do this again.');
      setFooter('It just doesn\'t work.');
    }
  }, [access_token, state, currentTime]);

  return <div className="container" style={{ background: colorProfile[status].background }}>
    <div className='card' style={{ borderColor: colorProfile[status].cardBorderColor }}>
      <div className='brand noselect'>
        <Logo />
        <span>Paper<b>Debugger</b></span>
      </div>
      <div style={{ color: colorProfile[status].textPrimaryColor, fontSize: 20, fontWeight: 600, marginTop: 24 }}>{title}</div>
      <div style={{ color: colorProfile[status].textDescColor, fontSize: 16, marginTop: 8 }}>{desc}</div>
      <div style={{ color: colorProfile[status].textFooterColor, fontSize: 14, marginTop: 8 }}>{footer}</div>
    </div>
  </div>;
}

export default App;
