export async function POST(request) {
  const { profile, entries, situation, tags } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY manquante. Ajoute-la dans .env.local" },
      { status: 500 }
    );
  }

  const recent = (entries || []).slice(-5).map((e) => ({
    date: e.date,
    situation: e.text,
    diagnostic: e.diagnostic,
    action: e.action,
  }));

  const system = `Tu es un copilote stratégique pour de très petites entreprises et indépendants francophones. On te donne le contexte d'une entreprise, son historique récent de décisions, et une nouvelle situation qu'elle rencontre aujourd'hui.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, au format exact :
{
  "diagnostic": "1-2 phrases, direct, qui nomme ce qui se joue vraiment dans cette situation",
  "action": "une action concrète et réalisable cette semaine, formulée à l'impératif",
  "dimension": "clients" | "tresorerie" | "croissance" | "visibilite",
  "delta": nombre entre -10 et 10 représentant l'impact estimé de cette situation sur la dimension choisie si l'action n'est pas prise (négatif si risque, positif si opportunité),
  "risque": "une phrase courte sur le risque principal si rien n'est fait, ou null si aucun risque notable"
}

Sois concret, sans jargon de consultant, adapté à une structure avec peu de temps et peu de budget.`;

  const userMsg = `Entreprise : ${profile.name}, secteur : ${profile.sector}.
Historique récent (du plus ancien au plus récent) : ${JSON.stringify(recent)}
Tags associés à la nouvelle situation : ${(tags || []).join(", ") || "aucun"}
Nouvelle situation décrite par l'entrepreneur : "${situation}"`;

  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return Response.json({ error: `Erreur API Anthropic: ${errText}` }, { status: 502 });
    }

    const data = await anthropicResponse.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) throw new Error("Réponse vide du copilote");

    const clean = textBlock.text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message || "Erreur inconnue" }, { status: 500 });
  }
}