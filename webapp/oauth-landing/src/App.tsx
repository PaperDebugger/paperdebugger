import { useEffect, useState } from 'react';
import './App.css';
import { Logo } from './components/logo';

const colorProfile = {
  default: {
    background: 'linear-gradient(135deg, #f6f7f9 0%, #e2e4ea 100%)', // 低调灰
    cardBorderColor: '#e2e4ea', // 浅灰色边框
    textPrimaryColor: '#222', // 主文字深灰
    textDescColor: '#666', // 描述文字中灰
    textFooterColor: '#aaa', // 脚注浅灰
  },
  success: {
    background: 'linear-gradient(135deg, #f3fcf7 0%, #b7eacb 100%)', // 低调绿
    cardBorderColor: '#b7eacb', // 绿色边框
    textPrimaryColor: '#217a4a', // 主文字深绿
    textDescColor: '#4ca96b', // 描述文字中绿
    textFooterColor: '#7fd6a3', // 脚注浅绿
  },
  error: {
    background: 'linear-gradient(135deg, #fdf7f7 0%, #f7d4d4 100%)', // 更浅更低调的红色
    cardBorderColor: '#f7d4d4', // 红色边框
    textPrimaryColor: '#a94442', // 主文字深红
    textDescColor: '#d9534f', // 描述文字中红
    textFooterColor: '#f7bcbc', // 脚注浅红
  },
  requesting: {
    background: 'linear-gradient(135deg, #fafaf5 0%, #f5e9be 100%)', // 低调黄
    cardBorderColor: '#f5e9be', // 黄色边框
    textPrimaryColor: '#8a6d3b', // 主文字深黄
    textDescColor: '#c7a94a', // 描述文字中黄
    textFooterColor: '#f5e9be', // 脚注浅黄
  },
}

type Status = 'default' | 'success' | 'error' | 'requesting';

function App() {
  const [title, setTitle] = useState('OAuth 登录');
  const [desc, setDesc] = useState('初始界面，可以关闭');
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
