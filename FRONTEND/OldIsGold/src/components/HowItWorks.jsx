function HowItWorks() {
    const steps = [
        ['01', 'Find your thing', 'Search useful products from students around your campus.'],
        ['02', 'Message the seller', 'Ask questions and arrange a convenient campus handoff.'],
        ['03', 'Keep it moving', 'Buy well, sell what you no longer need, and pass it on.'],
    ]

    return <section className="how-it-works"><div className="section-intro"><p className="eyebrow">Simple by design</p><h2>How CampusMart works</h2></div><div className="steps-grid">{steps.map(([number, title, copy]) => <div className="step" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{copy}</p></div>)}</div></section>
}

export default HowItWorks
