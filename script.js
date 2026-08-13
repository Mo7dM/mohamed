document.addEventListener('DOMContentLoaded', () => {
    // 1. Typing Effect for Subtitle
    const text = "I'm a student and developer focused on building clean, functional web experiences.";
    const typingElement = document.getElementById('typewriter');
    let i = 0;

    function typeWriter() {
        if (i < text.length) {
            typingElement.innerHTML += text.charAt(i);
            i++;
            setTimeout(typeWriter, 35); // typing speed
        }
    }
    // Start typing after a short delay
    setTimeout(typeWriter, 500);

    // 2. Scroll Reveal Animations
    const reveals = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 100; // when to trigger

        reveals.forEach(reveal => {
            const elementTop = reveal.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add('active');
            }
        });
    };

    // Listen for scroll
    window.addEventListener('scroll', revealOnScroll);
    // Trigger once on load to show elements already in view
    revealOnScroll();
});