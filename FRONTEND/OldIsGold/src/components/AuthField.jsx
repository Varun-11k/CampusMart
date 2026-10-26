import { useState } from 'react'

function AuthField({ label, name, type = 'text', error, ...inputProps }) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type
  const errorId = `${name}-error`

  return <label className={`auth-field${error ? ' has-error' : ''}`} htmlFor={name}>
    <span>{label}</span>
    <span className="auth-field-control">
      <input id={name} name={name} type={inputType} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...inputProps} />
      {isPassword && <button className="password-visibility" type="button" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? 'Hide' : 'Show'}</button>}
    </span>
    {error && <span className="auth-field-error" id={errorId}>{error}</span>}
  </label>
}

export default AuthField
