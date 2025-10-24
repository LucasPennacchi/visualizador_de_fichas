package br.com.visualizadorfichas.gm_dashboard_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data @JsonIgnoreProperties(ignoreUnknown = true)
public class CharacterFields {
    private StringValue name;
    private IntegerValue currentPv;
    private IntegerValue maxPv;
    private IntegerValue currentSan;
    private IntegerValue maxSan;
    private IntegerValue currentPe;
    private IntegerValue maxPe;
    @JsonProperty("sheetPictureURL") // O JSON usa URL maiúsculo
    private StringValue sheetPictureURL;
    private BooleanValue deathMode;
    private BooleanValue madnessMode;
    private IntegerValue evade;
    @JsonProperty("block") // 'block' é palavra reservada em Java
    private IntegerValue blockValue;
    private IntegerValue movement;
    private StringValue nex;
    private StringValue className;
    private IntegerValue currentLoad;
    private IntegerValue maxLoad;
}