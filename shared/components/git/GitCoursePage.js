/**
 * GitCoursePage — page générique pour tout le cours Git & GitHub.
 * Les 13 pages git/*.html partageaient une classe identique (`class GitXPage
 * extends ConceptPage {}`) ; elles utilisent désormais celle-ci (revue §C14).
 * Le comportement spécifique vit dans le contenu JSON et ses widgets.
 */
class GitCoursePage extends ConceptPage {}

if (typeof window !== 'undefined') {
    window.GitCoursePage = GitCoursePage;
}
