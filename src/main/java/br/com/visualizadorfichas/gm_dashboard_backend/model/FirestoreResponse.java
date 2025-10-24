package br.com.visualizadorfichas.gm_dashboard_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
@Data @JsonIgnoreProperties(ignoreUnknown = true)
public class FirestoreResponse {
    private CharacterFields fields;
}