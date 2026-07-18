const LATITUDE_LOJA = -23.000761054962886;
const LONGITUDE_LOJA = -47.51735362883598;

const RAIO_MAXIMO_KM = 7;

const PHOTON_URL = "https://photon.komoot.io/api";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

function normalizarResultado(feature) {
  const props = feature.properties || {};

  return {
    rua: props.street || props.name || "",
    bairro: props.district || props.suburb || props.city_district || "",

    cidade: props.city || props.town || props.village || "",

    estado: props.state || props.statecode || "",

    cep: props.postcode || "",

    latitude: feature.geometry?.coordinates?.[1] || null,

    longitude: feature.geometry?.coordinates?.[0] || null,

    osmId: props.osm_id || null,

    osmType: props.osm_type || null,
  };
}

export async function buscarEnderecos(texto) {
  const busca = texto.trim();

  if (busca.length < 2) {
    return [];
  }

  const url = `${PHOTON_URL}?q=${encodeURIComponent(
    busca + ", Capivari ou Rafard, São Paulo, Brasil",
  )}&limit=5`;

  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error("Erro ao buscar endereços.");
  }

  const dados = await resposta.json();

  return (dados.features || []).map(normalizarResultado).filter((item) => {
    if (!item.latitude || !item.longitude) {
      return false;
    }

    const distancia = calcularDistanciaKm(
      LATITUDE_LOJA,
      LONGITUDE_LOJA,
      item.latitude,
      item.longitude,
    );

    item.distanciaKm = distancia.toFixed(2);

    return distancia <= RAIO_MAXIMO_KM;
  });
}

export async function buscarEnderecoPorCoordenadas(latitude, longitude) {
  const url = `${NOMINATIM_URL}/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`;

  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!resposta.ok) {
    throw new Error("Erro ao buscar endereço.");
  }

  return await resposta.json();
}

export async function buscarDetalhesEndereco(latitude, longitude) {
  const resposta = await fetch(
    `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!resposta.ok) {
    throw new Error("Erro ao buscar detalhes do endereço.");
  }

  const dados = await resposta.json();

  return {
    cep: dados.address?.postcode || "",
    bairro:
      dados.address?.suburb ||
      dados.address?.city_district ||
      dados.address?.neighbourhood ||
      dados.address?.quarter ||
      "",
    cidade:
      dados.address?.city ||
      dados.address?.town ||
      dados.address?.village ||
      "",
    estado: dados.address?.state || "",
  };
}

export async function calcularDistanciaBee({
  origem,
  destino,
}) {

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origem.longitude},${origem.latitude};` +
    `${destino.longitude},${destino.latitude}` +
    `?overview=false`;


  const resposta = await fetch(url);

  const dados = await resposta.json();


  if (
    !dados.routes ||
    !dados.routes.length
  ) {
    throw new Error("Não foi possível calcular rota");
  }


  // metros para km
  return dados.routes[0].distance / 1000;
}

export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;

  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
