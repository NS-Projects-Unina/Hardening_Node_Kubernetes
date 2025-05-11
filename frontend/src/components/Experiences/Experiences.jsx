import { useEffect, useState } from "react";
import "./Experiences.css";
import userApi from "../../services/user";
import client from "../../services/graphql/apolloClient";
import {
  GET_ALL_PUBLIC_EXPS,
  GET_MY_EXPS,
} from "../../services/graphql/queries";
import Experience from "../Experience/Experience";
import { useSelector } from "react-redux";
import { FaSpinner } from "react-icons/fa";

function Experiences({ mine = false }) {
  const [fetchLoading, setFetchLoading] = useState(true);
  const { user } = useSelector((state) => state.auth);
  const [exps, setExps] = useState([]);
  const [category, setCategory] = useState("All");

  const categories = [
    { id: "5956cda7-09f0-437c-915b-c853d9f39fed", name: "Viaggi e Avventure" },
    { id: "b6c4fb32-3fb9-4b8c-a03d-37b0210f737d", name: "Crescita Personale" },
    { id: "7908505a-bcdc-4246-8209-74fa6a345bc1", name: "Relazioni" },
    { id: "c6a028a3-2ec2-46f6-86eb-ce80cd7f3f3f", name: "Lavoro e Carriera" },
    { id: "c9c86e8b-60b3-43dc-955e-849481777e7e", name: "Salute e Benessere" },
    { id: "cc93e49b-0092-48ef-b73a-393bed37de46", name: "Istruzione e Studio" },
    { id: "2310d56e-6ab5-42c8-941e-f8866a77bc9e", name: "Tecnologia" },
    { id: "a8bbba06-7b68-4005-a887-e141212bd0dc", name: "Spiritualità" },
    { id: "6755d975-a24e-43df-8f1a-e4c39da7e1b0", name: "Arte e Creatività" },
    {
      id: "c17e5d9c-4607-473b-9dab-b4a828727f87",
      name: "Volontariato e Impatto Sociale",
    },
  ];

  useEffect(() => {
    fetchExps();
  }, []);

  const fetchExps = async () => {
    setFetchLoading(true);
    try {
      const response = await client.query({
        query: mine ? GET_MY_EXPS : GET_ALL_PUBLIC_EXPS,
        fetchPolicy: "no-cache",
      });
      if (response.data.allPublicExperiences)
        setExps(response.data.allPublicExperiences);
      else setExps(response.data.getMyExperiences);
      setFetchLoading(false);
    } catch (err) {
      //console.log(err);
    }
  };

  const fetchByCategory = async (e) => {
    const categoryId = e.target.value;
    setCategory(categoryId);
    setFetchLoading(true);

    try {
      const isAll = categoryId === "All";

      const response = await client.query({
        query: GET_ALL_PUBLIC_EXPS,
        variables: isAll ? {} : { categoryId },
        fetchPolicy: "no-cache",
      });

      setExps(response.data.allPublicExperiences);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchLoading(false);
    }
  };

  return (
    <div className="experiences-div">
      {!mine && (
        <div className="filter">
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => {
              fetchByCategory(e);
            }}
          >
            <option value="All">Tutte le Categorie</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {fetchLoading ? (
        <div className="loading-div">
          <FaSpinner />
        </div>
      ) : (
        <div className="exps-div">
          {fetchLoading ? (
            <div className="loading-div">
              <FaSpinner />
            </div>
          ) : exps.length === 0 ? (
            <div className="empty-exps">
              {mine
                ? "Non hai ancora scritto nessuna esperienza"
                : "Non ci sono esperienze pubbliche disponibili"}
            </div>
          ) : (
            <div className="exps-div">
              {exps.map((item, index) => (
                <Experience
                  setExpsArray={setExps}
                  categoriesArray={categories}
                  data={item}
                  key={index}
                  isOwner={item.author.id === user.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Experiences;
