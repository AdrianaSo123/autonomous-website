// Shared Application Logic

/**
 * Sets up Intersection Observer for subtle fade-ins based on scroll position.
 * Applies `.visible` class to elements with `.fade-in` class.
 * @param {boolean} triggerHero - Overrides delay to trigger elements identified by hero/container immediately
 */
export const setupAnimations = (triggerHero = false) => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    if (triggerHero) {
        // Trigger immediately for hero to prevent popping
        setTimeout(() => {
            const heroSelector = document.querySelector('.hero');
            if (heroSelector) heroSelector.classList.add('visible');
            else {
                // blog/post logic trigger
                document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
            }
        }, 100);
    }
};

/**
 * Fetches the brand information from content.json to ensure site consistency.
 */
export async function loadBrandData() {
    try {
        const response = await fetch('content.json');
        if (!response.ok) throw new Error('Failed to load content for brand');
        const data = await response.json();

        const brandName = data.personal_brand?.name || "Adriana So";

        const navBrandNameEl = document.getElementById('nav-brand-name');
        if (navBrandNameEl) {
            navBrandNameEl.textContent = brandName;
        }

        return data; // Return full data for pages that need more than just the brand
    } catch (error) {
        console.error('Data hydration failed:', error);
        return null;
    }
}

/**
 * Strips frontmatter from markdown content
 * @param {string} markdown - The raw markdown file text
 * @returns {string} The markdown content without frontmatter
 */
export function stripFrontmatter(markdown) {
    let mdContent = markdown;
    if (mdContent.startsWith('---')) {
        const parts = mdContent.split('---');
        if (parts.length >= 3) {
            mdContent = parts.slice(2).join('---').trim();
        }
    }
    return mdContent;
}
